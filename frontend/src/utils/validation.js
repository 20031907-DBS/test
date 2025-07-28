/**
 * Input validation utilities
 */

export const ValidationRules = {
  REQUIRED: 'required',
  EMAIL: 'email',
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  PATTERN: 'pattern',
  CUSTOM: 'custom'
};

export const validateRequired = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'This field is required';
  }
  if (typeof value === 'string' && value.trim() === '') {
    return 'This field is required';
  }
  return null;
};

export const validateEmail = (email) => {
  if (!email) return null;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const validateMinLength = (value, minLength) => {
  if (!value) return null;
  
  if (value.length < minLength) {
    return `Must be at least ${minLength} characters long`;
  }
  return null;
};

export const validateMaxLength = (value, maxLength) => {
  if (!value) return null;
  
  if (value.length > maxLength) {
    return `Must be no more than ${maxLength} characters long`;
  }
  return null;
};

export const validatePattern = (value, pattern, message = 'Invalid format') => {
  if (!value) return null;
  
  const regex = new RegExp(pattern);
  if (!regex.test(value)) {
    return message;
  }
  return null;
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export const sanitizeMessage = (message) => {
  if (typeof message !== 'string') return '';
  
  // Allow basic formatting but remove dangerous content
  return message
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

export const validateMessage = (message) => {
  const errors = [];
  
  if (!message || message.trim() === '') {
    errors.push('Message cannot be empty');
  }
  
  if (message && message.length > 5000) {
    errors.push('Message is too long (maximum 5000 characters)');
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /https?:\/\/[^\s]+/gi // URLs (you might want to allow these)
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(message)) {
      // You might want to handle this differently
      break;
    }
  }
  
  return errors;
};

export const validateRoomId = (roomId) => {
  if (!roomId) {
    return 'Room ID is required';
  }
  
  if (typeof roomId !== 'string') {
    return 'Room ID must be a string';
  }
  
  if (roomId.length < 1 || roomId.length > 50) {
    return 'Room ID must be between 1 and 50 characters';
  }
  
  // Allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(roomId)) {
    return 'Room ID can only contain letters, numbers, hyphens, and underscores';
  }
  
  return null;
};

export const validateUserId = (userId) => {
  if (!userId) {
    return 'User ID is required';
  }
  
  if (typeof userId !== 'string' && typeof userId !== 'number') {
    return 'User ID must be a string or number';
  }
  
  return null;
};

export const createValidator = (rules) => {
  return (value) => {
    const errors = [];
    
    for (const rule of rules) {
      let error = null;
      
      switch (rule.type) {
        case ValidationRules.REQUIRED:
          error = validateRequired(value);
          break;
        case ValidationRules.EMAIL:
          error = validateEmail(value);
          break;
        case ValidationRules.MIN_LENGTH:
          error = validateMinLength(value, rule.value);
          break;
        case ValidationRules.MAX_LENGTH:
          error = validateMaxLength(value, rule.value);
          break;
        case ValidationRules.PATTERN:
          error = validatePattern(value, rule.pattern, rule.message);
          break;
        case ValidationRules.CUSTOM:
          error = rule.validator(value);
          break;
        default:
          break;
      }
      
      if (error) {
        errors.push(error);
      }
    }
    
    return errors;
  };
};