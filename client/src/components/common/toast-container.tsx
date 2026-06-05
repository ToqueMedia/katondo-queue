// Toast notification container — renders notifications from notification-store

import { useNotificationStore } from '../../store/notification-store';
import { Box, Text, VStack } from '@chakra-ui/react';

const typeStyles: Record<string, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: '#ECFDF5', border: '#059669', icon: '✓', color: '#065F46' },
  error: { bg: '#FEF2F2', border: '#DC2626', icon: '✕', color: '#991B1B' },
  warning: { bg: '#FFFBEB', border: '#D97706', icon: '!', color: '#92400E' },
  info: { bg: '#EFF6FF', border: '#2563EB', icon: 'i', color: '#1E40AF' },
};

export default function ToastContainer() {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <Box
      position="fixed"
      top="24px"
      right="24px"
      zIndex="9999"
      maxW="400px"
      w="full"
      pointerEvents="none"
    >
      <VStack gap={3} align="flex-end">
        {notifications.map((n) => {
          const style = typeStyles[n.type] || typeStyles.info;
          return (
            <Box
              key={n.id}
              bg={style.bg}
              borderLeft="4px solid"
              borderColor={style.border}
              borderRadius="12px"
              px={4}
              py={3}
              boxShadow="0 4px 16px rgba(10,25,47,0.10)"
              display="flex"
              alignItems="flex-start"
              gap={3}
              pointerEvents="auto"
              animation="slideIn 0.3s ease-out"
              w="full"
              _hover={{ boxShadow: '0 6px 20px rgba(10,25,47,0.14)' }}
              transition="box-shadow 0.2s"
            >
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={style.color}
                minW="20px"
                textAlign="center"
                mt="1px"
              >
                {style.icon}
              </Text>
              <VStack align="start" gap={0} flex={1}>
                <Text fontSize="sm" fontWeight="600" color={style.color} lineHeight="1.4">
                  {n.title}
                </Text>
                {n.description && (
                  <Text fontSize="xs" color={style.color} opacity={0.8} lineHeight="1.4">
                    {n.description}
                  </Text>
                )}
              </VStack>
              <Text
                as="button"
                fontSize="xs"
                fontWeight="bold"
                color={style.color}
                opacity={0.5}
                cursor="pointer"
                _hover={{ opacity: 1 }}
                onClick={() => removeNotification(n.id)}
                aria-label="Fechar"
              >
                ✕
              </Text>
            </Box>
          );
        })}
      </VStack>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </Box>
  );
}
