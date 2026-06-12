// Management — Dashboard with KPIs (redesigned)

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, SimpleGrid, Card, Badge, Flex, Box } from '@chakra-ui/react';
import { getTodayIndicators, getTodayIndicatorsByService } from '../../api/indicators';
import { useNotificationStore } from '../../store/notification-store';
import { formatDurationFromMinutes } from '../../utils/time-format';
import type { TodayIndicators, ServiceIndicators } from '../../api/indicators';

export default function ManagementDashboard() {
  const [indicators, setIndicators] = useState<TodayIndicators | null>(null);
  const [byService, setByService] = useState<ServiceIndicators[]>([]);
  const [loading, setLoading] = useState(true);
  const notify = useNotificationStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [today, services] = await Promise.all([
        getTodayIndicators(),
        getTodayIndicatorsByService(),
      ]);
      setIndicators(today);
      setByService(services);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar indicadores' });
    } finally { setLoading(false); }
  };

  const statCards = [
    { label: 'Emitidas', value: indicators?.issued ?? 0, color: '#1565C0', bg: '#EFF6FF', icon: '🎫' },
    { label: 'Atendidas', value: indicators?.served ?? 0, color: '#059669', bg: '#ECFDF5', icon: '✓' },
    { label: 'Canceladas', value: indicators?.cancelled ?? 0, color: '#DC2626', bg: '#FEF2F2', icon: '✕' },
    { label: 'Espera Média', value: formatDurationFromMinutes(indicators?.avgWaitMin), color: '#D97706', bg: '#FFFBEB', icon: '⏱' },
  ];

  return (
    <VStack gap={8} align="stretch">
      <VStack gap={1} align="start">
        <Heading size="lg" fontFamily="heading" fontWeight="400" color="brand.700">
          Dashboard — Gestão
        </Heading>
        <Text color="ink.muted" fontSize="sm">
          {new Date().toLocaleDateString('pt', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </VStack>

      {loading ? (
        <SimpleGrid columns={4} gap={4}>
          {[1,2,3,4].map(i => (
            <Card.Root key={i} p={6} borderRadius="16px" bg="white" shadow="card">
              <Box h="60px" bg="blackAlpha.50" borderRadius="8px" />
            </Card.Root>
          ))}
        </SimpleGrid>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={4}>
            {statCards.map((stat) => (
              <Card.Root
                key={stat.label}
                p={6}
                borderRadius="16px"
                bg="white"
                shadow="card"
                border="1px solid"
                borderColor="blackAlpha.50"
                _hover={{ shadow: 'cardHover', transform: 'translateY(-2px)' }}
                transition="all 0.2s ease"
              >
                <VStack align="start" gap={3}>
                  <Flex
                    w="40px"
                    h="40px"
                    borderRadius="10px"
                    bg={stat.bg}
                    align="center"
                    justify="center"
                    fontSize="lg"
                  >
                    {stat.icon}
                  </Flex>
                  <VStack gap={0} align="start">
                    <Text fontSize="sm" color="ink.muted" fontWeight="500">{stat.label}</Text>
                    <Text fontSize="3xl" fontWeight="700" color={stat.color} lineHeight="1.1">
                      {stat.value}
                    </Text>
                  </VStack>
                </VStack>
              </Card.Root>
            ))}
          </SimpleGrid>

          <Card.Root
            p={6}
            borderRadius="16px"
            bg="white"
            shadow="card"
            border="1px solid"
            borderColor="blackAlpha.50"
          >
            <VStack align="stretch" gap={5}>
              <Flex justify="space-between" align="center">
                <Heading size="md" fontWeight="600" color="ink.DEFAULT">
                  Por Serviço
                </Heading>
                <Badge colorPalette="brand" variant="subtle" px={3} py={1} borderRadius="8px">
                  Hoje
                </Badge>
              </Flex>

              {byService.length === 0 ? (
                <VStack py={12} align="center" gap={3}>
                  <Text fontSize="3xl" opacity={0.3}>📊</Text>
                  <Text color="ink.muted" fontSize="sm">Sem dados para hoje.</Text>
                </VStack>
              ) : (
                <VStack gap={3} align="stretch">
                  {byService.map((svc) => (
                    <Flex
                      key={svc.serviceId}
                      p={4}
                      borderRadius="12px"
                      bg="surface.muted"
                      border="1px solid"
                      borderColor="blackAlpha.50"
                      justify="space-between"
                      align="center"
                      _hover={{ bg: 'white', shadow: 'card' }}
                      transition="all 0.15s"
                    >
                      <VStack align="start" gap={0}>
                        <Text fontWeight="600" color="ink.DEFAULT" fontSize="sm">{svc.serviceName}</Text>
                        <Text fontSize="xs" color="ink.faint">
                          {svc.served} de {svc.issued} atendidas
                        </Text>
                      </VStack>
                      <Flex gap={6} align="center">
                        <VStack align="center" gap={0}>
                          <Text fontSize="xs" color="ink.faint">Espera</Text>
                          <Text fontWeight="600" color="brand.600" fontSize="sm">{formatDurationFromMinutes(svc.avgWaitMin)}</Text>
                        </VStack>
                        <VStack align="center" gap={0}>
                          <Text fontSize="xs" color="ink.faint">Atend.</Text>
                          <Text fontWeight="600" color="emerald.600" fontSize="sm">{formatDurationFromMinutes(svc.avgServiceMin)}</Text>
                        </VStack>
                        <Badge
                          colorPalette={svc.issued > 0 && svc.served / svc.issued > 0.8 ? 'emerald' : 'orange'}
                          variant="subtle"
                          borderRadius="6px"
                        >
                          {svc.issued > 0 ? Math.round((svc.served / svc.issued) * 100) : 0}%
                        </Badge>
                      </Flex>
                    </Flex>
                  ))}
                </VStack>
              )}
            </VStack>
          </Card.Root>
        </>
      )}
    </VStack>
  );
}
