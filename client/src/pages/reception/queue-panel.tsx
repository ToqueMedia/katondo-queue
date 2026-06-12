// Reception — Queue Panel (redesigned)

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, HStack, Button, Card, Badge, Flex, Box, Separator, Field, NativeSelect } from '@chakra-ui/react';
import { Tooltip } from '../../components/ui/tooltip';
import { useAuthStore } from '../../store/auth-store';
import { useNavigate } from 'react-router-dom';
import { useQueueStore } from '../../store/queue-store';
import { useSocket } from '../../hooks/useSocket';
import { useQueue } from '../../hooks/useQueue';
import { listTickets, getActiveTicket } from '../../api/tickets';
import { listAreas } from '../../api/areas';
import { listStations } from '../../api/stations';
import { updateActiveStation } from '../../api/users';
import { logout as apiLogout } from '../../api/auth';
import { useNotificationStore } from '../../store/notification-store';
import type { TicketRow, AreaRow, StationRow } from '../../types';

export default function ReceptionQueue() {
  const authStore = useAuthStore();
  const navigate = useNavigate();
  const queueStore = useQueueStore();
  const notify = useNotificationStore();
  const areaId = authStore.user?.areaId || 0;
  const stationId = authStore.user?.stationId || 0;

  const [waiting, setWaiting] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Workspace setup states (for mobile/dynamic receptionists)
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedStation, setSelectedStation] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(false);

  useEffect(() => {
    if (areaId === 0 || stationId === 0) {
      const loadSetupData = async () => {
        try {
          const [arList, stList] = await Promise.all([listAreas(), listStations()]);
          setAreas(arList.filter(a => a.active));
          setStations(stList.filter(s => s.active));
        } catch (err) {
          console.error(err);
        }
      };
      loadSetupData();
    }
  }, [areaId, stationId]);

  const handleConfirmSetup = async () => {
    if (!selectedArea || !selectedStation) return;
    setLoadingSetup(true);
    try {
      const parsedAreaId = parseInt(selectedArea);
      const parsedStationId = parseInt(selectedStation);
      const res = await updateActiveStation(parsedAreaId, parsedStationId);

      // Update session with the fresh tokens containing the active area/station claims!
      authStore.login(res.user, res.token, res.refreshToken);

      // Guardar a estação seleccionada no localStorage local do dispositivo
      localStorage.setItem('katondo_browser_station_id', String(parsedStationId));
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao seleccionar posto' });
    } finally {
      setLoadingSetup(false);
    }
  };

  const current = queueStore.currentTicket;
  const hasActiveTicket = !!(current && (current.status === 'called' || current.status === 'in_service'));

  const handleSwitchStation = async () => {
    if (hasActiveTicket) {
      notify.addNotification({
        type: 'warning',
        title: 'Sessão activa',
        description: 'Termine ou cancele a senha em atendimento antes de trocar de posto.',
      });
      return;
    }
    // Let the receptionist log out of this specific station and choose another
    setLoadingSetup(true);
    try {
      const res = await updateActiveStation(null, null);
      authStore.login(res.user, res.token, res.refreshToken);
      setSelectedArea('');
      setSelectedStation('');
      queueStore.setCurrentTicket(null);
      queueStore.setNextTickets([]);
      queueStore.setWaitingCount(0);

      // Remover a estação seleccionada do localStorage local do dispositivo ao trocar de posto
      localStorage.removeItem('katondo_browser_station_id');
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao trocar de posto' });
    } finally {
      setLoadingSetup(false);
    }
  };

  // Sync local state with socket/store updates so changes reflect in real time
  useEffect(() => {
    if (areaId !== 0) {
      setWaiting(queueStore.nextTickets);
    }
  }, [queueStore.nextTickets, areaId]);

  useEffect(() => {
    if (queueStore.currentTicket && areaId !== 0) {
      // Refresh waiting list when current ticket changes (call/start/complete/cancel)
      setWaiting(queueStore.nextTickets);
    }
  }, [queueStore.currentTicket?.id, areaId]);

  const handleLogout = async () => {
    if (hasActiveTicket) {
      notify.addNotification({
        type: 'warning',
        title: 'Sessão activa',
        description: 'Termine ou cancele a senha em atendimento antes de sair.',
      });
      return;
    }
    try {
      await apiLogout();
    } catch (e) {
      console.error('Logout API failed', e);
    }
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

  // Listen for administrator forcing release of this station
  useEffect(() => {
    const handleStationReleased = () => {
      notify.addNotification({
        type: 'warning',
        title: 'Estação libertada',
        description: 'Um administrador libertou o seu posto de atendimento. Por favor, selecione novamente.',
      });
      // Limpar posto localmente para redirecionar à seleção de posto
      authStore.updateUserActiveStation(0, 0);
      localStorage.removeItem('katondo_browser_station_id');
      queueStore.setCurrentTicket(null);
      queueStore.setNextTickets([]);
      queueStore.setWaitingCount(0);
    };
    window.addEventListener('auth:station-released', handleStationReleased);
    return () => window.removeEventListener('auth:station-released', handleStationReleased);
  }, [authStore, queueStore, notify]);

  // Prevenir fecho da aba (browser) com ticket em andamento
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveTicket) {
        e.preventDefault();
        e.returnValue = ''; 
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasActiveTicket]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [waitingTickets, activeTicketResult] = await Promise.all([
        listTickets(areaId, 'waiting', 'today'),
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

  if (areaId === 0 || stationId === 0) {
    const availableStations = selectedArea
      ? stations.filter(s => s.areaId === parseInt(selectedArea))
      : [];

    return (
      <Box minH="100vh" bg="#F6F8FB" p={{ base: 4, md: 6 }} display="flex" alignItems="center" justifyContent="center" w="100%">
        <Card.Root maxW="480px" w="100%" borderRadius="8px" shadow="elevated" border="1px solid" borderColor="#E5E7EB" bg="white" overflow="hidden">
          <Box bg="#1565C0" px={8} py={7}>
            <Box maxW="250px" bg="rgba(10,25,47,0.18)" borderRadius="8px" px={5} py={4} mx="auto">
              <img src="/logo-katondo.png" alt="Clínica Katondo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </Box>
          </Box>

          <VStack gap={6} align="stretch" p={8}>
            <VStack gap={2} align="center">
              <Heading size="md" color="#0A192F" textAlign="center" fontWeight="700">
                Seleccionar Posto
              </Heading>
              <Text fontSize="sm" color="ink.muted" textAlign="center" lineHeight="1.6">
                {authStore.user?.name || authStore.user?.username}, escolha a área e a estação para iniciar atendimento.
              </Text>
            </VStack>

            <Separator />

            <VStack gap={5} align="stretch">
              <Field.Root>
                <Field.Label fontSize="xs" fontWeight="700" color="#334155" textTransform="uppercase" mb={1}>
                  Área de atendimento
                </Field.Label>
                <NativeSelect.Root size="lg">
                  <NativeSelect.Field
                    value={selectedArea}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setSelectedArea(e.target.value);
                      setSelectedStation('');
                    }}
                    fontSize="sm"
                    fontWeight="500"
                    borderRadius="8px"
                    border="1px solid"
                    borderColor="#D8DEE7"
                  >
                    <option value="">Selecione a área...</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label fontSize="xs" fontWeight="700" color="#334155" textTransform="uppercase" mb={1}>
                  Recepção / estação
                </Field.Label>
                <NativeSelect.Root size="lg" disabled={!selectedArea}>
                  <NativeSelect.Field
                    value={selectedStation}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedStation(e.target.value)}
                    fontSize="sm"
                    fontWeight="500"
                    borderRadius="8px"
                    border="1px solid"
                    borderColor="#D8DEE7"
                  >
                    <option value="">Selecione a recepção...</option>
                    {availableStations.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.description ? `— ${s.description}` : ''}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              </Field.Root>
            </VStack>

            <Button
              colorPalette="blue"
              onClick={handleConfirmSetup}
              disabled={!selectedArea || !selectedStation}
              loading={loadingSetup}
              h={12}
              borderRadius="8px"
              fontWeight="700"
              fontSize="sm"
              shadow="0 8px 18px rgba(21,101,192,0.20)"
              _hover={{ transform: 'translateY(-1px)', shadow: '0 10px 22px rgba(21,101,192,0.26)' }}
              transition="all 0.2s"
            >
              Entrar na Recepção
            </Button>

            <Button variant="ghost" size="sm" onClick={handleLogout} colorPalette="gray" fontSize="xs">
              Sair da Conta
            </Button>
          </VStack>
        </Card.Root>
      </Box>
    );
  }

  return (
    <Box h="100vh" bg="#F6F8FB" p={{ base: 4, md: 5 }} overflow="hidden" display="flex" flexDirection="column" w="100%">
      <VStack gap={4} align="stretch" w="100%" h="100%" display="flex" flexDirection="column">
        <Flex
          bg="#1565C0"
          color="white"
          borderRadius="8px"
          px={{ base: 4, md: 5 }}
          py={4}
          justify="space-between"
          align={{ base: 'start', md: 'center' }}
          gap={4}
          flexShrink={0}
          direction={{ base: 'column', md: 'row' }}
          boxShadow="0 12px 28px rgba(21,101,192,0.18)"
        >
          <HStack gap={4} align="center">
            <Box bg="rgba(10,25,47,0.18)" borderRadius="8px" px={4} py={3} w="220px" flexShrink={0}>
              <img src="/logo-katondo.png" alt="Clínica Katondo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </Box>
            <VStack gap={1} align="start">
              <Heading size="md" fontWeight="700" letterSpacing="0">
                Recepção
              </Heading>
              <Text fontSize="sm" color="whiteAlpha.800">
                {authStore.user?.name || authStore.user?.username} · Posto {stationId} · Área {areaId}
              </Text>
            </VStack>
          </HStack>

          <HStack gap={2} align="center" wrap="wrap" justify={{ base: 'start', md: 'end' }}>
            <Badge
              px={3}
              py={2}
              borderRadius="8px"
              fontSize="sm"
              fontWeight="700"
              bg="white"
              color="#1565C0"
            >
              {waiting.length} em espera
            </Badge>
            <Tooltip
              content="Termine a senha em atendimento antes de trocar"
              disabled={!hasActiveTicket}
              positioning={{ placement: 'bottom' }}
            >
              <Button
                size="sm"
                variant="solid"
                onClick={handleSwitchStation}
                loading={loadingSetup}
                disabled={!!hasActiveTicket}
                borderRadius="8px"
                fontSize="xs"
                bg="whiteAlpha.200"
                color="white"
                _hover={{ bg: hasActiveTicket ? 'whiteAlpha.200' : 'whiteAlpha.300' }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                Trocar Posto
              </Button>
            </Tooltip>
            <Tooltip
              content="Termine a senha em atendimento antes de sair"
              disabled={!hasActiveTicket}
              positioning={{ placement: 'bottom' }}
            >
              <Button
                size="sm"
                variant="solid"
                onClick={() => navigate('/reception/account')}
                disabled={!!hasActiveTicket}
                borderRadius="8px"
                fontSize="xs"
                bg="whiteAlpha.200"
                color="white"
                _hover={{ bg: hasActiveTicket ? 'whiteAlpha.200' : 'whiteAlpha.300' }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                Minha Conta
              </Button>
            </Tooltip>
            <Tooltip
              content="Termine a senha em atendimento antes de sair"
              disabled={!hasActiveTicket}
              positioning={{ placement: 'bottom' }}
            >
              <Button
                size="sm"
                variant="solid"
                onClick={handleLogout}
                disabled={!!hasActiveTicket}
                bg="whiteAlpha.200"
                color="white"
                _hover={{ bg: hasActiveTicket ? 'whiteAlpha.200' : 'whiteAlpha.300' }}
                _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                borderRadius="8px"
                fontSize="xs"
              >
                Sair
              </Button>
            </Tooltip>
          </HStack>
        </Flex>

        <Flex gap={4} flex={1} minH={0} direction={{ base: 'column', lg: 'row' }}>
          <VStack gap={4} align="stretch" flex="0 0 44%" minW={{ lg: '420px' }}>
            <Card.Root
              p={{ base: 5, md: 6 }}
              borderRadius="8px"
              bg="white"
              shadow="card"
              border="1px solid"
              borderColor={current ? '#B7E4D6' : '#E5E7EB'}
              textAlign="center"
              flex={1}
              minH="320px"
              justifyContent="center"
            >
              <VStack gap={5} align="center">
                <Text fontSize="xs" fontWeight="700" color="#64748B" textTransform="uppercase">
                  Senha em atendimento
                </Text>

                {current ? (
                  <>
                    <Text
                      fontSize={{ base: '5xl', md: '7xl' }}
                      fontWeight="800"
                      color="#0A192F"
                      lineHeight="1"
                    >
                      {current.number}
                    </Text>
                    <HStack gap={3} justify="center" wrap="wrap">
                      <Badge
                        px={3}
                        py={1.5}
                        borderRadius="8px"
                        fontSize="sm"
                        fontWeight="700"
                        bg={current.status === 'in_service' ? '#ECFDF5' : '#FFF7ED'}
                        color={current.status === 'in_service' ? '#059669' : '#D97706'}
                      >
                        {current.status === 'in_service' ? 'Em Atendimento' : 'Chamada'}
                      </Badge>
                      <Badge px={3} py={1.5} borderRadius="8px" bg="#F1F5F9" color="#334155">
                        Posto {current.stationId}
                      </Badge>
                      {current.status === 'called' && (
                        <Text fontSize="sm" color="ink.muted">
                          Chamada {current.callCount || 0}/2
                        </Text>
                      )}
                    </HStack>
                    <Flex gap={3} mt={2} wrap="wrap" justify="center">
                      {current.status === 'called' && (
                        <>
                          <Button
                            colorPalette="green"
                            size="md"
                            borderRadius="8px"
                            px={6}
                            fontWeight="700"
                            onClick={() => handleStartService(current.id)}
                            loading={actionLoading}
                          >
                            Iniciar Atendimento
                          </Button>
                          {(current.callCount || 0) < 2 && (
                            <Button
                              colorPalette="blue"
                              size="md"
                              borderRadius="8px"
                              px={6}
                              fontWeight="700"
                              onClick={() => handleRecall(current.id)}
                              loading={actionLoading}
                            >
                              Chamar Novamente
                            </Button>
                          )}
                          <Button
                            colorPalette="red"
                            size="md"
                            borderRadius="8px"
                            px={6}
                            fontWeight="700"
                            variant="outline"
                            onClick={() => handleNoShow(current.id)}
                            loading={actionLoading}
                          >
                            Descartar
                          </Button>
                        </>
                      )}
                      {current.status === 'in_service' && (
                        <Button
                          colorPalette="blue"
                          size="md"
                          borderRadius="8px"
                          px={8}
                          fontWeight="700"
                          onClick={() => handleCompleteService(current.id)}
                          loading={actionLoading}
                        >
                          Concluir Atendimento
                        </Button>
                      )}
                    </Flex>
                  </>
                ) : (
                  <VStack gap={3} py={8}>
                    <Box w="56px" h="56px" borderRadius="8px" bg="#F1F5F9" display="flex" alignItems="center" justifyContent="center">
                      <Text fontSize="xl" fontWeight="800" color="#CBD5E1">00</Text>
                    </Box>
                    <Text color="ink.muted" fontSize="md" fontWeight="600">
                      Nenhuma senha em atendimento
                    </Text>
                    <Text color="ink.faint" fontSize="sm">
                      Chame a próxima senha para iniciar.
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Card.Root>

            <Button
              size="lg"
              colorPalette="blue"
              onClick={handleCallNext}
              loading={actionLoading}
              disabled={!areaId || !stationId || !canCallNext}
              h={14}
              fontSize="md"
              fontWeight="700"
              borderRadius="8px"
              shadow="0 8px 18px rgba(21,101,192,0.22)"
              _hover={{ transform: 'translateY(-1px)', boxShadow: '0 10px 22px rgba(21,101,192,0.28)' }}
              transition="all 0.2s"
              flexShrink={0}
            >
              Chamar Próxima Senha
            </Button>
          </VStack>

          <Card.Root
            flex={1}
            minH={0}
            borderRadius="8px"
            bg="white"
            shadow="card"
            border="1px solid"
            borderColor="#E5E7EB"
            overflow="hidden"
          >
            <Flex justify="space-between" align="center" px={5} py={4} borderBottom="1px solid" borderColor="#E5E7EB" flexShrink={0}>
              <VStack align="start" gap={0}>
                <Heading size="sm" fontWeight="700" color="#0A192F">
                  Fila de Espera
                </Heading>
                <Text fontSize="xs" color="ink.muted">
                  {waiting.length} senha{waiting.length !== 1 ? 's' : ''} aguardando
                </Text>
              </VStack>
              <Badge colorPalette={waiting.length > 0 ? 'blue' : 'gray'} borderRadius="8px" px={3} py={1}>
                Hoje
              </Badge>
            </Flex>

            <Box flex={1} overflowY="auto" p={4} minH={0}>
              {loading ? (
                <VStack gap={2}>
                  {[1,2,3].map(i => (
                    <Box key={i} h="64px" bg="#F8FAFC" borderRadius="8px" border="1px solid" borderColor="#E5E7EB">
                      <Box h="full" bg="#EEF2F7" borderRadius="8px" animation="pulse 2s infinite" />
                    </Box>
                  ))}
                </VStack>
              ) : waiting.length === 0 ? (
                <VStack gap={2} align="center" py={12}>
                  <Text color="ink.muted" fontWeight="600">Nenhuma senha em fila</Text>
                  <Text fontSize="sm" color="ink.faint">Aguardando novos utentes.</Text>
                </VStack>
              ) : (
                <VStack gap={2} align="stretch">
                  {waiting.map((ticket, idx) => (
                    <Flex
                      key={ticket.id}
                      p={4}
                      bg={idx === 0 ? '#F8FBFF' : 'white'}
                      border="1px solid"
                      borderColor={idx === 0 ? '#BFD7F6' : '#E5E7EB'}
                      borderRadius="8px"
                      justify="space-between"
                      align="center"
                      transition="all 0.15s"
                    >
                      <Flex gap={4} align="center" minW={0}>
                        <Box
                          w="34px"
                          h="34px"
                          borderRadius="8px"
                          bg={idx === 0 ? '#1565C0' : '#F1F5F9'}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <Text fontSize="sm" fontWeight="700" color={idx === 0 ? 'white' : 'ink.muted'}>
                            {idx + 1}
                          </Text>
                        </Box>
                        <VStack align="start" gap={0} minW={0}>
                          <Text fontWeight="800" fontSize="lg" color="#0A192F">{ticket.number}</Text>
                          <Text fontSize="xs" color="ink.faint">
                            {ticket.serviceName || 'Serviço'} · {new Date(ticket.createdAt).toLocaleTimeString('pt')}
                          </Text>
                        </VStack>
                      </Flex>
                      <Badge
                        colorPalette={idx === 0 ? 'blue' : 'gray'}
                        variant="subtle"
                        px={3}
                        py={1}
                        borderRadius="8px"
                        fontSize="xs"
                        flexShrink={0}
                      >
                        {idx === 0 ? 'Próxima' : 'Aguardando'}
                      </Badge>
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>
          </Card.Root>
        </Flex>
      </VStack>
    </Box>
  );
}
