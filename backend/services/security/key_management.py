"""
Key Management Service for RSA public key validation and management
"""

import re
from typing import Optional


class KeyManagementService:
    """Service for managing RSA keys and validation"""
    
    @staticmethod
    def validate_public_key(public_key: str) -> bool:
        """
        Validate RSA public key format (PEM format)
        
        Args:
            public_key: The public key string to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        if not public_key or not isinstance(public_key, str):
            return False
            
        # Check for PEM format markers
        if not public_key.strip().startswith('-----BEGIN PUBLIC KEY-----'):
            return False
            
        if not public_key.strip().endswith('-----END PUBLIC KEY-----'):
            return False
            
        # Basic structure validation
        lines = public_key.strip().split('\n')
        if len(lines) < 3:  # At minimum: header, content, footer
            return False
            
        # Check that middle lines contain base64-like content
        for line in lines[1:-1]:  # Skip header and footer
            if line and not re.match(r'^[A-Za-z0-9+/=]+$', line):
                return False
                
        return True
    
    @staticmethod
    def extract_key_info(public_key: str) -> Optional[dict]:
        """
        Extract basic information from a public key
        
        Args:
            public_key: The public key string
            
        Returns:
            dict: Key information or None if invalid
        """
        if not KeyManagementService.validate_public_key(public_key):
            return None
            
        return {
            'format': 'PEM',
            'type': 'RSA',
            'size_estimate': len(public_key.replace('\n', '').replace(' ', ''))
        }
    
    @staticmethod
    def sanitize_public_key(public_key: str) -> Optional[str]:
        """
        Sanitize and normalize a public key
        
        Args:
            public_key: The public key string to sanitize
            
        Returns:
            str: Sanitized key or None if invalid
        """
        if not public_key:
            return None
            
        # Remove extra whitespace and normalize line endings
        sanitized = public_key.strip().replace('\r\n', '\n').replace('\r', '\n')
        
        # Validate the sanitized key
        if KeyManagementService.validate_public_key(sanitized):
            return sanitized
            
        return None