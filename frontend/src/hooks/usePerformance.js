import { useEffect, useRef, useCallback } from 'react';

export const usePerformance = (componentName) => {
  const renderStartTime = useRef(null);
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    renderStartTime.current = performance.now();

    return () => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        if (process.env.NODE_ENV === 'development' && renderTime > 16) {
          console.warn(
            `${componentName} render took ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
          );
        }
      }
    };
  });

  const measureAsync = useCallback(async (operationName, asyncOperation) => {
    const startTime = performance.now();
    try {
      const result = await asyncOperation();
      const endTime = performance.now();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`${componentName}.${operationName} took ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(
        `${componentName}.${operationName} failed after ${(endTime - startTime).toFixed(2)}ms:`,
        error
      );
      throw error;
    }
  }, [componentName]);

  const measureSync = useCallback((operationName, syncOperation) => {
    const startTime = performance.now();
    try {
      const result = syncOperation();
      const endTime = performance.now();
      
      if (process.env.NODE_ENV === 'development' && endTime - startTime > 5) {
        console.warn(`${componentName}.${operationName} took ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      console.error(
        `${componentName}.${operationName} failed after ${(endTime - startTime).toFixed(2)}ms:`,
        error
      );
      throw error;
    }
  }, [componentName]);

  return { measureAsync, measureSync };
};

export const useMemoryMonitor = () => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const logMemory = () => {
        const memory = performance.memory;
        console.log('Memory usage:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
        });
      };

      const interval = setInterval(logMemory, 30000); // Log every 30 seconds
      return () => clearInterval(interval);
    }
  }, []);
};

export const useConnectionMonitor = () => {
  useEffect(() => {
    const handleOnline = () => {
      console.log('Connection restored');
    };

    const handleOffline = () => {
      console.warn('Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline: typeof window !== 'undefined' ? navigator.onLine : true
  };
};