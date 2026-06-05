// Admin — Dashboard Overview with real-time station delegation & traffic monitoring

import { useState, useEffect } from 'react';
import { Heading, Text, SimpleGrid, Card, VStack, Badge, Flex, Box, Button, HStack, Portal } from '@chakra-ui/react';
import { Dialog } from '@chakra-ui/react';
import { getTodayIndicators, getTodayIndicatorsByService } from '../../api/indicators';
import { listAreas } from '../../api/areas';
import { listStations, updateStation } from '../../api/stations';
import { listServices } from '../../api/services';
import { listUsers } from '../../api/users';
import { listTickets } from '../../api/tickets';
import { useSocket } from '../../hooks/useSocket';
import { useNotificationStore } from '../../store/notification-store';
import type { TodayIndicators, ServiceIndicators } from '../../api/indicators';
import type { AreaRow, StationRow, ServiceRow, UserRow, TicketRow } from '../../types';

export default function AdminDashboard() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

  const [indicators, setIndicators] = useState<TodayIndicators | null>(null);
  const [byService, setByService] = useState<ServiceIndicators[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [receptionists, setReceptionists] = useState<UserRow[]>([]);
  const [waitingTickets, setWaitingTickets] = useState<TicketRow[]>([]);
  const [activeTickets, setActiveTickets] = useState<TicketRow[]>([]);

  // States for ALL areas (real-time cross-area traffic summary)
  const [allWaitingTickets, setAllWaitingTickets] = useState<TicketRow[]>([]);
  const [allActiveTickets, setAllActiveTickets] = useState<TicketRow[]>([]);
  const [allCompletedTickets, setAllCompletedTickets] = useState<TicketRow[]>([]);

  const [loading, setLoading] = useState(true);
  const notify = useNotificationStore();

  // Dialog state for Quick Delegation
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegatingStation, setDelegatingStation] = useState<StationRow | null>(null);
  const [delegatingServiceIds, setDelegatingServiceIds] = useState<number[]>([]);
  const [savingDelegate, setSavingDelegate] = useState(false);

  // Initialize socket connection for real-time updates based on selected Area
  const socket = useSocket(selectedAreaId);

  // Load all areas on mount
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const list = await listAreas();
        setAreas(list);
        if (list.length > 0) {
          setSelectedAreaId(list[0].id); // Default to first area
        }
      } catch {
        notify.addNotification({ type: 'error', title: 'Erro ao carregar áreas' });
      }
    };
    fetchAreas();
  }, []);

  // Fetch all real-time dashboard data
  const loadData = async (showLoading = true) => {
    if (!selectedAreaId) return;
    if (showLoading) setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [
        today,
        todayServices,
        stationsList,
        servicesList,
        usersList,
        waiting,
        called,
        inService,
        // Fetch cross-area data for the unselected real-time monitoring
        allWaiting,
        allCalled,
        allInService,
        allCompleted,
      ] = await Promise.all([
        getTodayIndicators(selectedAreaId),
        getTodayIndicatorsByService(selectedAreaId),
        listStations(selectedAreaId),
        listServices(selectedAreaId),
        listUsers(),
        listTickets(selectedAreaId, 'waiting', todayStr),
        listTickets(selectedAreaId, 'called', todayStr),
        listTickets(selectedAreaId, 'in_service', todayStr),

        listTickets(undefined, 'waiting', todayStr),
        listTickets(undefined, 'called', todayStr),
        listTickets(undefined, 'in_service', todayStr),
        listTickets(undefined, 'completed', todayStr),
      ]);

      setIndicators(today);
      setByService(todayServices);
      setStations(stationsList);
      setServices(servicesList);
      setReceptionists(usersList);
      setWaitingTickets(waiting);
      setActiveTickets([...called, ...inService]);

      // Populate cross-area states
      setAllWaitingTickets(allWaiting);
      setAllActiveTickets([...allCalled, ...allInService]);
      setAllCompletedTickets(allCompleted);
    } catch (err) {
      console.error('[Dashboard] Error fetching data:', err);
      notify.addNotification({ type: 'error', title: 'Erro ao atualizar indicadores' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Re-fetch when selected area changes
  useEffect(() => {
    loadData(true);
  }, [selectedAreaId]);

  // Hook into Socket.IO for REAL-TIME live updates!
  useEffect(() => {
    if (!socket || !selectedAreaId) return;

    const handleRealtimeUpdate = () => {
      console.log('[Socket] Real-time event received. Auto-refreshing dashboard...');
      loadData(false); // Refresh silently in the background
    };

    // Listen to all queue & station events to keep dashboard synchronized in real-time
    socket.on('ticket:created', handleRealtimeUpdate);
    socket.on('ticket:called', handleRealtimeUpdate);
    socket.on('ticket:started', handleRealtimeUpdate);
    socket.on('ticket:completed', handleRealtimeUpdate);
    socket.on('ticket:cancelled', handleRealtimeUpdate);
    socket.on('queue:updated', handleRealtimeUpdate);
    socket.on('station:updated', handleRealtimeUpdate);

    return () => {
      socket.off('ticket:created', handleRealtimeUpdate);
      socket.off('ticket:called', handleRealtimeUpdate);
      socket.off('ticket:started', handleRealtimeUpdate);
      socket.off('ticket:completed', handleRealtimeUpdate);
      socket.off('ticket:cancelled', handleRealtimeUpdate);
      socket.off('queue:updated', handleRealtimeUpdate);
      socket.off('station:updated', handleRealtimeUpdate);
    };
  }, [socket, selectedAreaId]);

  // Handle saving delegated services
  const handleSaveDelegation = async () => {
    if (!delegatingStation) return;
    setSavingDelegate(true);
    try {
      await updateStation(delegatingStation.id, {
        serviceIds: delegatingServiceIds,
      });
      notify.addNotification({ type: 'success', title: 'Serviços re-delegados em tempo real!' });
      setDelegateOpen(false);
      loadData(false); // Silent reload
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao atualizar delegação' });
    } finally {
      setSavingDelegate(false);
    }
  };

  const openDelegationDialog = (st: StationRow) => {
    setDelegatingStation(st);
    setDelegatingServiceIds(st.serviceIds || []);
    setDelegateOpen(true);
  };

  const statCards = [
    { label: 'Senhas Emitidas', value: indicators?.issued ?? 0, color: '#1565C0', icon: '🎫', bg: '#EFF6FF' },
    { label: 'Senhas Atendidas', value: indicators?.served ?? 0, color: '#059669', icon: '✓', bg: '#ECFDF5' },
    { label: 'Espera Média', value: `${indicators?.avgWaitMin ?? 0} min`, color: '#D97706', icon: '⏱', bg: '#FFFBEB' },
    { label: 'Atend. Médio', value: `${indicators?.avgServiceMin ?? 0} min`, color: '#7C3AED', icon: '⚡', bg: '#F5F3FF' },
  ];

  return (
    <VStack gap={8} align="stretch">
      {/* Header and Area Selector */}
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4}>
        <VStack gap={1} align="start">
          <Heading size="lg" fontFamily="heading" fontWeight="400" color="brand.700">
            Painel de Monitorização em Tempo Real
          </Heading>
          <Text color="ink.muted" fontSize="sm">
            Visualização dinâmica e atribuição de serviços às estações de atendimento.
          </Text>
        </VStack>

        <Flex align="center" gap={3}>
          <Text fontSize="sm" fontWeight="600" color="brand.700">Área Activa:</Text>
          <select
            value={selectedAreaId || ''}
            onChange={(e) => setSelectedAreaId(parseInt(e.target.value, 10))}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid var(--chakra-colors-blackAlpha-200)',
              backgroundColor: 'white',
              fontSize: '14px',
              fontWeight: '500',
              color: 'var(--chakra-colors-brand-700)',
              outline: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(10,25,47,0.05)'
            }}
          >
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </Flex>
      </Flex>

      {loading ? (
        <SimpleGrid columns={4} gap={4}>
          {[1,2,3,4].map(i => (
            <Card.Root key={i} p={6} borderRadius="16px" bg="white" shadow="card">
              <Box h="60px" bg="blackAlpha.50" borderRadius="8px" animation="pulse 2s infinite" />
            </Card.Root>
          ))}
        </SimpleGrid>
      ) : (
        <>
          {/* Stat Cards */}
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

          {/* Tráfego Geral das Áreas (Tempo Real) */}
          <VStack align="stretch" gap={4}>
            <Heading size="md" fontWeight="bold" color="brand.800" px={1}>
              Fluxo e Tráfego por Área (Tempo Real)
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {areas.map((area) => {
                const waiting = allWaitingTickets.filter(t => t.areaId === area.id).length;
                const active = allActiveTickets.filter(t => t.areaId === area.id).length;
                const served = allCompletedTickets.filter(t => t.areaId === area.id).length;

                return (
                  <Card.Root
                    key={area.id}
                    p={5}
                    borderRadius="16px"
                    bg="white"
                    shadow="card"
                    border="1px solid"
                    borderColor="blackAlpha.50"
                    _hover={{ shadow: 'cardHover' }}
                    transition="all 0.15s ease"
                  >
                    <VStack align="stretch" gap={3}>
                      <Flex justify="space-between" align="center" borderBottom="1px solid" borderColor="blackAlpha.50" pb={2}>
                        <Text fontWeight="bold" fontSize="md" color="brand.700">
                          {area.name}
                        </Text>
                        <Badge colorPalette={waiting > 5 ? 'red' : 'emerald'} variant="solid" fontSize="10px" borderRadius="6px">
                          {waiting > 0 ? 'Activo' : 'Calmo'}
                        </Badge>
                      </Flex>

                      <SimpleGrid columns={3} gap={2} textAlign="center">
                        {/* Em Espera */}
                        <Box p={2} borderRadius="8px" bg="orange.50">
                          <VStack gap={0}>
                            <Text fontSize="9px" fontWeight="700" color="orange.600" textTransform="uppercase">Em Espera</Text>
                            <Text fontSize="lg" fontWeight="800" color="orange.700">{waiting}</Text>
                          </VStack>
                        </Box>

                        {/* Em Atendimento */}
                        <Box p={2} borderRadius="8px" bg="teal.50">
                          <VStack gap={0}>
                            <Text fontSize="9px" fontWeight="700" color="teal.600" textTransform="uppercase">Activos</Text>
                            <Text fontSize="lg" fontWeight="800" color="teal.700">{active}</Text>
                          </VStack>
                        </Box>

                        {/* Atendidos */}
                        <Box p={2} borderRadius="8px" bg="emerald.50">
                          <VStack gap={0}>
                            <Text fontSize="9px" fontWeight="700" color="emerald.600" textTransform="uppercase">Atendidos</Text>
                            <Text fontSize="lg" fontWeight="800" color="emerald.700">{served}</Text>
                          </VStack>
                        </Box>
                      </SimpleGrid>
                    </VStack>
                  </Card.Root>
                );
              })}
            </SimpleGrid>
          </VStack>

          {/* MAIN MONITORING ROW: Service Traffic & Station Load */}
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap={6}>

            {/* Service Traffic & Waiting Queues */}
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
                  <VStack align="start" gap={0}>
                    <Heading size="md" fontWeight="600" color="ink.DEFAULT">
                      Tráfego por Serviço (Filas de Espera)
                    </Heading>
                    <Text fontSize="xs" color="ink.muted">Fluxo de pacientes à espera de atendimento por especialidade.</Text>
                  </VStack>
                  <Badge colorPalette="emerald" variant="solid" px={3} py={1} borderRadius="8px">
                    Live
                  </Badge>
                </Flex>

                {byService.length === 0 ? (
                  <VStack py={12} align="center" gap={3}>
                    <Text fontSize="3xl" opacity={0.3}>📊</Text>
                    <Text color="ink.muted" fontSize="sm">Sem serviços ativos para hoje.</Text>
                  </VStack>
                ) : (
                  <VStack gap={3} align="stretch">
                    {byService.map((svc) => {
                      const waitingCount = waitingTickets.filter(t => t.serviceId === svc.serviceId).length;
                      return (
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
                          <VStack align="start" gap={1}>
                            <Text fontWeight="600" color="ink.DEFAULT" fontSize="sm">{svc.serviceName}</Text>
                            <HStack gap={3} align="center">
                              <Text fontSize="xs" color="ink.faint">
                                Atendidas hoje: <strong>{svc.served} de {svc.issued}</strong>
                              </Text>
                            </HStack>
                          </VStack>

                          <Flex gap={4} align="center">
                            {/* Live Waiting Badge */}
                            <Flex direction="column" align="center" px={3} py={1.5} bg={waitingCount > 5 ? 'red.50' : 'brand.50'} borderRadius="8px" border="1px solid" borderColor={waitingCount > 5 ? 'red.100' : 'brand.100'}>
                              <Text fontSize="10px" color={waitingCount > 5 ? 'red.600' : 'brand.600'} fontWeight="600" textTransform="uppercase" letterSpacing="0.05em">Em Espera</Text>
                              <Text fontSize="md" fontWeight="bold" color={waitingCount > 5 ? 'red.700' : 'brand.700'}>{waitingCount}</Text>
                            </Flex>

                            <VStack align="center" gap={0} minW="55px">
                              <Text fontSize="10px" color="ink.faint" textTransform="uppercase">Espera</Text>
                              <Text fontWeight="600" color="brand.600" fontSize="sm">{svc.avgWaitMin}m</Text>
                            </VStack>
                          </Flex>
                        </Flex>
                      );
                    })}
                  </VStack>
                )}
              </VStack>
            </Card.Root>

            {/* Station Status & Delegation Control */}
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
                  <VStack align="start" gap={0}>
                    <Heading size="md" fontWeight="600" color="ink.DEFAULT">
                      Monitorização de Estações (Tempo Real)
                    </Heading>
                    <Text fontSize="xs" color="ink.muted">Estado dos guichês e atribuição imediata de especialidades.</Text>
                  </VStack>
                  <Badge colorPalette="brand" variant="solid" px={3} py={1} borderRadius="8px">
                    Ativas
                  </Badge>
                </Flex>

                {stations.length === 0 ? (
                  <VStack py={12} align="center" gap={3}>
                    <Text fontSize="3xl" opacity={0.3}>🖥</Text>
                    <Text color="ink.muted" fontSize="sm">Nenhum guichê ou estação cadastrada nesta área.</Text>
                  </VStack>
                ) : (
                  <VStack gap={4} align="stretch">
                    {stations.map((st) => {
                      const operator = st.receptionUserId ? receptionists.find(u => u.id === st.receptionUserId)?.username : null;
                      const activeTicket = operator ? activeTickets.find(t => t.stationId === st.id) : null;

                      return (
                        <Box
                          key={st.id}
                          p={4}
                          borderRadius="12px"
                          bg="surface.muted"
                          border="1px solid"
                          borderColor="blackAlpha.50"
                          _hover={{ bg: 'white', shadow: 'card' }}
                          transition="all 0.15s"
                        >
                          <Flex justify="space-between" align="start" mb={3}>
                            <VStack align="start" gap={0}>
                              <Text fontWeight="bold" color="brand.700" fontSize="sm">{st.name}</Text>
                              <Text fontSize="xs" color="ink.muted">{st.description || 'Sem descrição'}</Text>
                            </VStack>

                            {/* Status Indicator */}
                            {activeTicket ? (
                              <Badge colorPalette="teal" variant="solid" px={2.5} py={0.5} borderRadius="6px" fontSize="xs">
                                Atendimento: {activeTicket.number}
                              </Badge>
                            ) : operator ? (
                              <Badge colorPalette="blue" variant="subtle" px={2.5} py={0.5} borderRadius="6px" fontSize="xs">
                                Livre (Operador: {operator})
                              </Badge>
                            ) : (
                              <Badge colorPalette="gray" variant="outline" px={2.5} py={0.5} borderRadius="6px" fontSize="xs">
                                Sem Operador
                              </Badge>
                            )}
                          </Flex>

                          <Flex justify="space-between" align="center" gap={2}>
                            {/* Delegated Services list */}
                            <Flex wrap="wrap" gap={1} maxW="70%">
                              {st.serviceIds && st.serviceIds.length > 0 ? (
                                st.serviceIds.map(sid => {
                                  const svcName = services.find(s => s.id === sid)?.name || 'Srv';
                                  return (
                                    <Badge key={sid} colorPalette="teal" variant="subtle" fontSize="9px" px={1.5} borderRadius="4px">
                                      {svcName}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <Text fontSize="xs" color="red.500" fontWeight="500">Nenhum serviço atribuído</Text>
                              )}
                            </Flex>

                            {/* Actions */}
                            <Button
                              size="xs"
                              colorPalette="brand"
                              variant="solid"
                              onClick={() => openDelegationDialog(st)}
                              fontSize="11px"
                              borderRadius="6px"
                              px={3}
                            >
                              ⚙️ Delegar
                            </Button>
                          </Flex>
                        </Box>
                      );
                    })}
                  </VStack>
                )}
              </VStack>
            </Card.Root>
          </SimpleGrid>
        </>
      )}

      {/* QUICK DELEGATION DIALOG — styled centered card modal */}
      {delegateOpen && delegatingStation && (
        <Dialog.Root open={delegateOpen} onOpenChange={(e: { open: boolean }) => setDelegateOpen(e.open)}>
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner p={4} display="flex" alignItems="center" justifyContent="center">
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="500px" w="100%" p={6}>
                <Dialog.Header pb={3} borderBottom="1px solid" borderColor="blackAlpha.100">
                  <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">
                    Delegar Serviços — {delegatingStation.name}
                  </Dialog.Title>
                  <Text fontSize="xs" color="ink.muted" mt={1}>
                    Selecione quais serviços este guichê pode atender. Mudanças refletem imediatamente no painel de chamada e nas recepções.
                  </Text>
                </Dialog.Header>

                <Dialog.Body py={4}>
                  <VStack align="start" width="100%" gap={2} maxH="280px" overflowY="auto" p={2} border="1px solid" borderColor="blackAlpha.100" borderRadius="md">
                    {services.map(svc => {
                      const isChecked = delegatingServiceIds.includes(svc.id);
                      return (
                        <Flex key={svc.id} gap={3} align="center" py={1.5} px={2} width="100%" borderRadius="6px" _hover={{ bg: 'surface.muted' }}>
                          <input
                            type="checkbox"
                            id={`delegate-svc-${svc.id}`}
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDelegatingServiceIds(prev => [...prev, svc.id]);
                              } else {
                                setDelegatingServiceIds(prev => prev.filter(id => id !== svc.id));
                              }
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer',
                              accentColor: 'var(--chakra-colors-brand-500)'
                            }}
                          />
                          <label
                            htmlFor={`delegate-svc-${svc.id}`}
                            style={{
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: isChecked ? '600' : '400',
                              color: isChecked ? 'var(--chakra-colors-brand-800)' : 'var(--chakra-colors-ink-DEFAULT)',
                              width: '100%'
                            }}
                          >
                            {svc.name}
                          </label>
                        </Flex>
                      );
                    })}
                    {services.length === 0 && (
                      <Text fontSize="xs" color="gray.500">Sem serviços cadastrados para esta área.</Text>
                    )}
                  </VStack>
                </Dialog.Body>

                <Dialog.Footer pt={3} borderTop="1px solid" borderColor="blackAlpha.100" display="flex" justifyContent="end" gap={3}>
                  <Button variant="ghost" size="sm" onClick={() => setDelegateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button colorPalette="teal" size="sm" loading={savingDelegate} onClick={handleSaveDelegation}>
                    Gravar Alterações
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </VStack>
  );
}
