// Admin — Ticket Management (Real-time tracking and deletion)

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Table, Badge, Button,
  Text, HStack, NativeSelect, Dialog, Portal, VStack
} from '@chakra-ui/react';
import { listAreas } from '../../api/areas';
import { listTickets, deleteTicket } from '../../api/tickets';
import { useSocket } from '../../hooks/useSocket';
import { useNotificationStore } from '../../store/notification-store';
import { AdminPageHeader, AdminTableCard } from '../../components/admin/admin-page';
import type { AreaRow, TicketRow } from '../../types';

export default function TicketManagement() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | ''>('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<number | null>(null);

  const notify = useNotificationStore();
  const socket = useSocket(selectedAreaId === '' ? null : Number(selectedAreaId));

  const fetchAreas = async () => {
    try {
      const data = await listAreas();
      setAreas(data);
      if (data.length > 0) setSelectedAreaId(data[0].id);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar áreas' });
    }
  };

  const fetchTickets = useCallback(async (showLoading = true) => {
    if (!selectedAreaId) return;
    if (showLoading) setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Fetch active tickets: waiting, called, in_service
      const [waiting, called, inService] = await Promise.all([
        listTickets(Number(selectedAreaId), 'waiting', todayStr),
        listTickets(Number(selectedAreaId), 'called', todayStr),
        listTickets(Number(selectedAreaId), 'in_service', todayStr),
      ]);
      
      // Sort ascending: oldest first, so later hours go to the bottom
      const allActive = [...waiting, ...called, ...inService].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      setTickets(allActive);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar senhas' });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [selectedAreaId, notify]);

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (selectedAreaId !== '') {
      fetchTickets();
    }
  }, [selectedAreaId, fetchTickets]);

  // Handle Socket.IO events for real-time updates
  useEffect(() => {
    if (!socket || selectedAreaId === '') return;

    const handleUpdate = () => fetchTickets(false);

    socket.on('ticket:created', handleUpdate);
    socket.on('ticket:called', handleUpdate);
    socket.on('ticket:started', handleUpdate);
    socket.on('ticket:completed', handleUpdate);
    socket.on('ticket:cancelled', handleUpdate);
    socket.on('ticket:deleted', handleUpdate);

    return () => {
      socket.off('ticket:created', handleUpdate);
      socket.off('ticket:called', handleUpdate);
      socket.off('ticket:started', handleUpdate);
      socket.off('ticket:completed', handleUpdate);
      socket.off('ticket:cancelled', handleUpdate);
      socket.off('ticket:deleted', handleUpdate);
    };
  }, [socket, selectedAreaId, fetchTickets]);

  const confirmDelete = async () => {
    if (!ticketToDelete) return;
    
    try {
      await deleteTicket(ticketToDelete);
      notify.addNotification({ type: 'success', title: 'Senha eliminada com sucesso' });
      setTicketToDelete(null);
      fetchTickets(false);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao eliminar senha' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'blue';
      case 'called': return 'yellow';
      case 'in_service': return 'green';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting': return 'Em espera';
      case 'called': return 'Chamada';
      case 'in_service': return 'Em atendimento';
      default: return status;
    }
  };

  return (
    <VStack gap={6} align="stretch">
      <AdminPageHeader
        title="Gestão de Senhas"
        description="Acompanhe e controle senhas activas em tempo real por área."
        action={
          <HStack gap={3} bg="white" p={2} borderRadius="10px" border="1px solid" borderColor="blackAlpha.100" shadow="sm">
            <Box w="240px">
              <NativeSelect.Root size="md" variant="subtle">
                <NativeSelect.Field 
                  value={selectedAreaId} 
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAreaId(e.target.value === '' ? '' : Number(e.target.value))}
                  bg="gray.50"
                  borderRadius="md"
                  fontWeight="medium"
                >
                  <option value="" disabled>Selecione uma área</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Box>
            <Button 
              onClick={() => fetchTickets()}
              loading={loading}
              colorPalette="teal"
              size="md"
            >
              Actualizar
            </Button>
          </HStack>
        }
      />

        <AdminTableCard>
            <Table.Root variant="line">
              <Table.Header>
                <Table.Row bg="gray.50">
                  <Table.ColumnHeader>Número</Table.ColumnHeader>
                  <Table.ColumnHeader>Serviço</Table.ColumnHeader>
                  <Table.ColumnHeader>Estado</Table.ColumnHeader>
                  <Table.ColumnHeader>Estação</Table.ColumnHeader>
                  <Table.ColumnHeader>Hora</Table.ColumnHeader>
                  <Table.ColumnHeader w="100px" textAlign="right">Acções</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tickets.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={6} py={16}>
                      <VStack gap={4} justify="center">
                        <Text color="gray.500" fontSize="md" fontWeight="medium">Nenhuma senha activa encontrada para esta área.</Text>
                      </VStack>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  tickets.map((ticket) => (
                    <Table.Row 
                      key={ticket.id}
                      transition="all 0.2s"
                      _hover={{ bg: "gray.50" }}
                      position="relative"
                      zIndex={1}
                    >
                      <Table.Cell fontWeight="bold" fontSize="lg" color="brand.700" fontFamily="mono">
                        {ticket.number}
                      </Table.Cell>
                      <Table.Cell fontWeight="medium" color="gray.700">{ticket.serviceName}</Table.Cell>
                      <Table.Cell>
                        <Badge 
                          colorPalette={getStatusColor(ticket.status)} 
                          size="md" 
                          px={3} 
                          py={1} 
                          borderRadius="full"
                          fontWeight="bold"
                        >
                          {getStatusLabel(ticket.status)}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell color="gray.600" fontWeight="medium">{ticket.stationName || '-'}</Table.Cell>
                      <Table.Cell color="gray.500">
                        <HStack gap={2}>
                          <Text>{new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        </HStack>
                      </Table.Cell>
                      <Table.Cell textAlign="right">
                        <Button
                          aria-label="Eliminar senha"
                          size="sm"
                          colorPalette="red"
                          variant="ghost"
                          onClick={() => setTicketToDelete(ticket.id)}
                          _hover={{ bg: "red.100", color: "red.600" }}
                        >
                          Eliminar
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
        </AdminTableCard>

        {/* Confirmation Dialog */}
        <Dialog.Root open={ticketToDelete !== null} onOpenChange={(e) => !e.open && setTicketToDelete(null)}>
          <Portal>
            <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
            <Dialog.Positioner>
              <Dialog.Content bg="white" borderRadius="16px" boxShadow="lg" maxW="440px" w="100%" p={6}>
                <Dialog.Header pt={8} pb={4}>
                  <VStack gap={4} align="center">
                    <Dialog.Title fontSize="lg" fontWeight="bold" color="brand.700">
                      Confirmar Eliminação
                    </Dialog.Title>
                  </VStack>
                </Dialog.Header>
                <Dialog.Body pb={6} textAlign="center" color="gray.600" fontSize="lg">
                  Tem a certeza que deseja eliminar permanentemente esta senha?
                  <br />
                  <Text as="span" fontWeight="bold" color="red.500" mt={2} display="inline-block">
                    Esta acção é irreversível.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer bg="gray.50" borderBottomRadius="xl" pt={4} pb={4} display="flex" justifyContent="center" gap={4}>
                  <Button variant="outline" onClick={() => setTicketToDelete(null)} size="lg" borderRadius="lg" minW="120px">
                    Cancelar
                  </Button>
                  <Button colorPalette="red" onClick={confirmDelete} size="lg" borderRadius="lg" minW="120px">
                    Eliminar
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
    </VStack>
  );
}
