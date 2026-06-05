// Reception — Queue Panel (redesigned)

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, HStack, Button, Card, Badge, Flex, Box, Separator, IconButton } from '@chakra-ui/react';
import { useAuthStore } from '../../store/auth-store';
import { useNavigate } from 'react-router-dom';
import { useQueueStore } from '../../store/queue-store';
import { useSocket } from '../../hooks/useSocket';
import { useQueue } from '../../hooks/useQueue';
import { listTickets, getActiveTicket } from '../../api/tickets';
import type { TicketRow } from '../../types';

export default function ReceptionQueue() {
  const authStore = useAuthStore();
  const navigate = useNavigate();
  const queueStore = useQueueStore();
  const areaId = authStore.user?.areaId || 0;
  const stationId = authStore.user?.stationId || 0;

  const [waiting, setWaiting] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync local state with socket/store updates so changes reflect in real time
  useEffect(() => {
    setWaiting(queueStore.nextTickets);
  }, [queueStore.nextTickets]);

  useEffect(() => {
    if (queueStore.currentTicket) {
      // Refresh waiting list when current ticket changes (call/start/complete/cancel)
      setWaiting(queueStore.nextTickets);
    }
  }, [queueStore.currentTicket?.id]);

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  useSocket(areaId);
  const { loading: actionLoading, handleCallNext, handleStartService, handleCompleteService, handleNoShow, handleRecall, canCallNext } = useQueue(areaId, stationId);

  useEffect(() => {
    if (!areaId) return;
    loadQueue();
  }, [areaId]);

  // Listen for auth expiration and redirect to login
  useEffect(() => {
    const handleAuthExpired = () => {
      authStore.logout();
      navigate('/login');
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [authStore, navigate]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [waitingTickets, activeTicketResult] = await Promise.all([
        listTickets(areaId, 'waiting', undefined, stationId),
        stationId ? getActiveTicket(stationId) : Promise.resolve({ ticket: null }),
      ]);
      setWaiting(waitingTickets);
      queueStore.setNextTickets(waitingTickets);
      queueStore.setWaitingCount(waitingTickets.length);
      // Persist active ticket for this station (called or in_service)
      if (activeTicketResult.ticket) {
        queueStore.setCurrentTicket(activeTicketResult.ticket);
      }
    } catch {
      // Error handled by notification store
    } finally {
      setLoading(false);
    }
  };

  const current = queueStore.currentTicket;

  return (
    <Box h="100vh" bg="#FAFAF9" p={6} overflow="hidden" display="flex" flexDirection="column" w="100%">
      <VStack gap={6} align="stretch" w="100%" h="100%" display="flex" flexDirection="column">
        {/* Header */}
        <Flex justify="space-between" align="center" flexShrink={0}>
          <VStack gap={0} align="start">
            <Heading size="lg" fontFamily="heading" fontWeight="400" color="brand.700">
              Painel de Fila
            </Heading>
            <Text fontSize="sm" color="ink.muted">
              Estação {stationId || '—'} | Área {areaId || '—'}
            </Text>
          </VStack>
          <HStack gap={3} align="center">
            <Badge
              px={4}
              py={2}
              borderRadius="10px"
              fontSize="md"
              fontWeight="600"
              bg={waiting.length > 5 ? '#FEF2F2' : '#ECFDF5'}
              color={waiting.length > 5 ? '#DC2626' : '#059669'}
              border={`1px solid ${waiting.length > 5 ? '#FECACA' : '#A7F3D0'}`}
            >
              {waiting.length} em espera
            </Badge>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Sair"
              onClick={handleLogout}
              color="ink.muted"
              _hover={{ color: 'brand.600', bg: 'brand.50' }}
              borderRadius="8px"
            >
              🚪
            </IconButton>
          </HStack>
        </Flex>

        {/* Current Ticket — Hero */}
        <Card.Root
          p={8}
          borderRadius="20px"
          bg={current ? 'white' : 'surface.muted'}
          shadow={current ? 'elevated' : 'card'}
          border="1px solid"
          borderColor={current ? 'emerald.200' : 'blackAlpha.50'}
          textAlign="center"
          flexShrink={0}
        >
          <VStack gap={4} align="center">
            <Text fontSize="xs" fontWeight="600" color="ink.faint" letterSpacing="0.1em" textTransform="uppercase">
              Senha em Atendimento
            </Text>

            {current ? (
              <>
                <Text
                  fontSize="6xl"
                  fontWeight="800"
                  color="brand.700"
                  lineHeight="1"
                  letterSpacing="-0.02em"
                >
                  {current.number}
                </Text>
                <Flex gap={3} align="center">
                  <Badge
                    px={3}
                    py={1}
                    borderRadius="8px"
                    fontSize="sm"
                    fontWeight="600"
                    bg={current.status === 'in_service' ? '#ECFDF5' : '#FFF7ED'}
                    color={current.status === 'in_service' ? '#059669' : '#D97706'}
                  >
                    {current.status === 'in_service' ? 'Em Atendimento' : 'Chamada'}
                  </Badge>
                  <Text fontSize="sm" color="ink.muted">Estação {current.stationId}</Text>
                  {current.status === 'called' && (
                    <Text fontSize="xs" color="ink.faint">
                      Chamada {current.callCount || 0}/2
                    </Text>
                  )}
                </Flex>
                <Flex gap={3} mt={2} wrap="wrap" justify="center">
                  {current.status === 'called' && (
                    <>
                      <Button
                        colorPalette="emerald"
                        size="lg"
                        borderRadius="12px"
                        px={8}
                        fontWeight="600"
                        onClick={() => handleStartService(current.id)}
                        loading={actionLoading}
                        _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 16px rgba(5,150,105,0.25)' }}
                        transition="all 0.2s"
                      >
                        Iniciar Atendimento
                      </Button>
                      {(current.callCount || 0) < 2 && (
                        <Button
                          colorPalette="blue"
                          size="lg"
                          borderRadius="12px"
                          px={8}
                          fontWeight="600"
                          onClick={() => handleRecall(current.id)}
                          loading={actionLoading}
                          _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 16px rgba(21,101,192,0.25)' }}
                          transition="all 0.2s"
                        >
                          Chamar Novamente
                        </Button>
                      )}
                      <Button
                        colorPalette="red"
                        size="lg"
                        borderRadius="12px"
                        px={8}
                        fontWeight="600"
                        variant="outline"
                        onClick={() => handleNoShow(current.id)}
                        loading={actionLoading}
                        _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 16px rgba(220,38,38,0.25)' }}
                        transition="all 0.2s"
                      >
                        Descartar Senha
                      </Button>
                    </>
                  )}
                  {current.status === 'in_service' && (
                    <Button
                      colorPalette="brand"
                      size="lg"
                      borderRadius="12px"
                      px={8}
                      fontWeight="600"
                      onClick={() => handleCompleteService(current.id)}
                      loading={actionLoading}
                      _hover={{ transform: 'translateY(-1px)', boxShadow: '0 4px 16px rgba(21,101,192,0.25)' }}
                      transition="all 0.2s"
                    >
                      Concluir Atendimento
                    </Button>
                  )}
                </Flex>
              </>
            ) : (
              <VStack gap={3} py={6}>
                <Text fontSize="4xl" opacity={0.2}>🎫</Text>
                <Text color="ink.muted" fontSize="md">
                  Nenhuma senha em atendimento
                </Text>
                <Text color="ink.faint" fontSize="sm">
                  Chame a próxima senha para iniciar
                </Text>
              </VStack>
            )}
          </VStack>
        </Card.Root>

        {/* Call Next Button */}
        <Button
          size="lg"
          colorPalette="brand"
          onClick={handleCallNext}
          loading={actionLoading}
          disabled={!areaId || !stationId || !canCallNext}
          h={16}
          fontSize="xl"
          fontWeight="600"
          borderRadius="16px"
          shadow="0 4px 16px rgba(21,101,192,0.20)"
          _hover={{ transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(21,101,192,0.30)' }}
          transition="all 0.2s"
          flexShrink={0}
        >
          Chamar Próxima Senha →
        </Button>

        <Separator borderColor="blackAlpha.100" flexShrink={0} />

        {/* Waiting List */}
        <VStack gap={3} align="stretch" flex={1} overflow="hidden">
          <Flex justify="space-between" align="center" flexShrink={0}>
            <Heading size="md" fontWeight="600" color="ink.DEFAULT">
              Fila de Espera
            </Heading>
            <Text fontSize="sm" color="ink.faint">
              {waiting.length} senha{waiting.length !== 1 ? 's' : ''}
            </Text>
          </Flex>

          <Box flex={1} overflowY="auto" pr={2}>
            {loading ? (
              <VStack gap={2}>
                {[1,2,3].map(i => (
                  <Box key={i} h="56px" bg="white" borderRadius="12px" border="1px solid" borderColor="blackAlpha.50">
                    <Box h="full" bg="blackAlpha.50" borderRadius="12px" animation="pulse 2s infinite" />
                  </Box>
                ))}
              </VStack>
            ) : waiting.length === 0 ? (
              <Card.Root p={8} borderRadius="16px" bg="white" shadow="card" textAlign="center">
                <VStack gap={2} align="center">
                  <Text fontSize="3xl" opacity={0.2}>🪑</Text>
                  <Text color="ink.muted">Nenhuma senha em fila</Text>
                  <Text fontSize="sm" color="ink.faint">Aguardando novos utentes</Text>
                </VStack>
              </Card.Root>
            ) : (
              <VStack gap={2} align="stretch" pb={4}>
                {waiting.map((ticket, idx) => (
                  <Flex
                    key={ticket.id}
                    p={4}
                    bg="white"
                    border="1px solid"
                    borderColor="blackAlpha.50"
                    borderRadius="12px"
                    justify="space-between"
                    align="center"
                    _hover={{ borderColor: 'brand.200', shadow: 'card' }}
                    transition="all 0.15s"
                  >
                    <Flex gap={4} align="center">
                      <Box
                        w="32px"
                        h="32px"
                        borderRadius="8px"
                        bg={idx === 0 ? '#EFF6FF' : '#F5F5F4'}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize="sm" fontWeight="600" color={idx === 0 ? 'brand.600' : 'ink.muted'}>
                          {idx + 1}
                        </Text>
                      </Box>
                      <VStack align="start" gap={0}>
                        <Text fontWeight="700" fontSize="lg" color="ink.DEFAULT">{ticket.number}</Text>
                        <Text fontSize="xs" color="ink.faint">
                          {new Date(ticket.createdAt).toLocaleTimeString('pt')}
                        </Text>
                      </VStack>
                    </Flex>
                    <Badge
                      colorPalette="orange"
                      variant="subtle"
                      px={3}
                      py={1}
                      borderRadius="6px"
                      fontSize="xs"
                    >
                      Aguardando
                    </Badge>
                  </Flex>
                ))}
              </VStack>
            )}
          </Box>
        </VStack>
      </VStack>
    </Box>
  );
}
