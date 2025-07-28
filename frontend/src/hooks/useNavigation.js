import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export const useNavigation = () => {
  const router = useRouter();

  const navigateToChat = useCallback((roomId = null) => {
    if (roomId && roomId !== 'general') {
      router.push(`/chat/${roomId}`);
    } else {
      router.push('/chat');
    }
  }, [router]);

  const navigateToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const navigateHome = useCallback(() => {
    router.push('/');
  }, [router]);

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const canGoBack = useCallback(() => {
    return window.history.length > 1;
  }, []);

  return {
    navigateToChat,
    navigateToLogin,
    navigateHome,
    goBack,
    canGoBack
  };
};