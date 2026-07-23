// Dispensador — touch UI for emitting tickets (senhas)
// Patients pick a service and receive a ticket number. Services render in a
// 2-column grid; when they exceed the screen the overflow collapses under an
// "Outros" button that opens a dialog with the remaining services.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, VStack, HStack, Heading, Text, Button, Badge, SimpleGrid, Dialog, Spinner,
} from '@chakra-ui/react';
import { useAuthStore } from '../../store/auth-store';
import { useNotificationStore } from '../../store/notification-store';
import { getServices } from '../../api/services';
import { emitDispenserTicket } from '../../api/dispenser';
import { logout as apiLogout } from '../../api/auth';
import type { ServiceRow } from '../../types';

// Maximum service tiles (incl. "Outros") that fit comfortably on the screen
// (2 columns × 4 rows). Extra services collapse under "Outros".
const MAX_TILES = 8;

interface EmittedTicket {
  number: string;
  serviceName: string;
}

export default function DispenserPanel() {
  const authStore = useAuthStore();
  const navigate = useNavigate();
  const notify = useNotificationStore();
  const areaId = authStore.user?.areaId || 0;

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState<number | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const [emitted, setEmitted] = useState<EmittedTicket | null>(null);

  // Load the services available for this dispenser's area (incl. global ones)
  useEffect(() => {
    if (!areaId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const list = await getServices(areaId);
        setServices(list.filter((s) => s.active));
      } catch {
        notify.addNotification({ type: 'error', title: 'Erro ao carregar serviços' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [areaId]);

  // Auto-dismiss the emitted-ticket confirmation
  useEffect(() => {
    if (!emitted) return;
    const t = setTimeout(() => setEmitted(null), 7000);
    return () => clearTimeout(t);
  }, [emitted]);

  const handleEmit = async (service: ServiceRow) => {
    if (emitting) return;
    setEmitting(service.id);
    try {
      const ticket = await emitDispenserTicket(service.id, areaId);
      setOthersOpen(false);
      setEmitted({ number: ticket.number, serviceName: service.name });
    } catch (err: any) {
      notify.addNotification({
        type: 'error',
        title: err.response?.data?.error || 'Não foi possível emitir a senha',
      });
    } finally {
      setEmitting(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // ignore — clear local session regardless
    }
    authStore.logout();
    navigate('/login');
  };

  // Priority services first, so they are never hidden behind "Outros"
  const sorted = [...services].sort(
    (a, b) => Number(b.isPriority) - Number(a.isPriority),
  );
  const overflow = sorted.length > MAX_TILES;
  const primaryServices = overflow ? sorted.slice(0, MAX_TILES - 1) : sorted;
  const otherServices = overflow ? sorted.slice(MAX_TILES - 1) : [];

  const ServiceTile = ({ service, compact }: { service: ServiceRow; compact?: boolean }) => (
    <Button
      onClick={() => handleEmit(service)}
      loading={emitting === service.id}
      disabled={!!emitting && emitting !== service.id}
      h={compact ? '96px' : '120px'}
      w="100%"
      whiteSpace="normal"
      borderRadius="12px"
      bg="white"
      color="#0A192F"
      border="2px solid"
      borderColor={service.isPriority ? '#F5B301' : '#D8DEE7'}
      shadow="0 4px 12px rgba(10,25,47,0.06)"
      _hover={{ bg: '#F8FBFF', borderColor: '#1565C0', transform: 'translateY(-2px)' }}
      _active={{ transform: 'translateY(0)' }}
      transition="all 0.15s"
      display="flex"
      flexDirection="column"
      gap={2}
      px={4}
    >
      {service.isPriority && (
        <Badge
          bg="#FEF3C7"
          color="#B45309"
          borderRadius="pill"
          px={2}
          py={0.5}
          fontSize="xs"
          fontWeight="700"
        >
          Prioritário
        </Badge>
      )}
      <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight="700" lineHeight="1.2" textAlign="center">
        {service.name}
      </Text>
    </Button>
  );

  return (
    <Box h="100vh" bg="#F6F8FB" display="flex" flexDirection="column" overflow="hidden" w="100%">
      {/* Header */}
      <Flex
        bg="#1565C0"
        color="white"
        px={{ base: 4, md: 8 }}
        py={4}
        justify="space-between"
        align="center"
        flexShrink={0}
        boxShadow="0 12px 28px rgba(21,101,192,0.18)"
      >
        <HStack gap={4} align="center">
          <Box bg="rgba(10,25,47,0.18)" borderRadius="8px" px={4} py={2} w="180px" flexShrink={0}>
            <img src="/logo-katondo.png" alt="Clínica Katondo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </Box>
          <VStack gap={0} align="start">
            <Heading size="md" fontWeight="700">Dispensador de Senhas</Heading>
            <Text fontSize="sm" color="whiteAlpha.800">
              {authStore.user?.name || authStore.user?.username}
            </Text>
          </VStack>
        </HStack>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleLogout}
          color="whiteAlpha.800"
          borderRadius="8px"
          fontSize="xs"
          _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
        >
          Sair
        </Button>
      </Flex>

      {/* Body */}
      <Box flex={1} minH={0} overflowY="auto" px={{ base: 4, md: 8 }} py={{ base: 5, md: 7 }}>
        <VStack gap={6} align="stretch" maxW="820px" mx="auto" w="100%">
          <VStack gap={1} align="center" textAlign="center">
            <Heading size="lg" color="#0A192F" fontWeight="800">
              Seleccione o serviço
            </Heading>
            <Text fontSize="md" color="ink.muted">
              Toque no serviço pretendido para retirar a sua senha.
            </Text>
          </VStack>

          {loading ? (
            <VStack gap={3} py={16}>
              <Spinner size="xl" color="#1565C0" />
              <Text color="ink.muted">A carregar serviços...</Text>
            </VStack>
          ) : !areaId ? (
            <VStack gap={2} py={16} textAlign="center">
              <Text fontWeight="700" color="#0A192F">Dispensador sem área associada</Text>
              <Text fontSize="sm" color="ink.muted">
                Peça a um administrador para associar este dispensador a uma área.
              </Text>
            </VStack>
          ) : sorted.length === 0 ? (
            <VStack gap={2} py={16} textAlign="center">
              <Text fontWeight="700" color="#0A192F">Nenhum serviço disponível</Text>
              <Text fontSize="sm" color="ink.muted">
                Não há serviços activos para esta área de momento.
              </Text>
            </VStack>
          ) : (
            <SimpleGrid columns={2} gap={4}>
              {primaryServices.map((service) => (
                <ServiceTile key={service.id} service={service} />
              ))}
              {overflow && (
                <Button
                  onClick={() => setOthersOpen(true)}
                  h="120px"
                  w="100%"
                  whiteSpace="normal"
                  borderRadius="12px"
                  bg="#1565C0"
                  color="white"
                  border="2px solid"
                  borderColor="#1565C0"
                  shadow="0 8px 18px rgba(21,101,192,0.22)"
                  _hover={{ bg: '#0F559F', transform: 'translateY(-2px)' }}
                  _active={{ transform: 'translateY(0)' }}
                  transition="all 0.15s"
                  display="flex"
                  flexDirection="column"
                  gap={1}
                >
                  <Text fontSize="2xl" fontWeight="800">Outros</Text>
                  <Text fontSize="sm" color="whiteAlpha.800">
                    +{otherServices.length} serviço{otherServices.length !== 1 ? 's' : ''}
                  </Text>
                </Button>
              )}
            </SimpleGrid>
          )}
        </VStack>
      </Box>

      {/* "Outros" — remaining services dialog */}
      <Dialog.Root open={othersOpen} onOpenChange={(e) => setOthersOpen(e.open)} size="lg">
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="16px" maxW="720px" w="calc(100% - 32px)" overflow="hidden">
            <Flex bg="#1565C0" color="white" px={6} py={4} justify="space-between" align="center">
              <VStack gap={0} align="start">
                <Heading size="md" fontWeight="700">Outros serviços</Heading>
                <Text fontSize="sm" color="whiteAlpha.800">Toque para retirar a sua senha.</Text>
              </VStack>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOthersOpen(false)}
                color="whiteAlpha.900"
                _hover={{ bg: 'whiteAlpha.200' }}
                borderRadius="8px"
              >
                Fechar
              </Button>
            </Flex>
            <Box p={6} maxH="70vh" overflowY="auto">
              <SimpleGrid columns={2} gap={4}>
                {otherServices.map((service) => (
                  <ServiceTile key={service.id} service={service} compact />
                ))}
              </SimpleGrid>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Emitted-ticket confirmation overlay */}
      {emitted && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(10,25,47,0.72)"
          backdropFilter="blur(4px)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={2000}
          onClick={() => setEmitted(null)}
          p={4}
        >
          <Box
            bg="white"
            borderRadius="20px"
            px={{ base: 8, md: 12 }}
            py={{ base: 8, md: 10 }}
            textAlign="center"
            maxW="480px"
            w="100%"
            shadow="0 24px 60px rgba(0,0,0,0.35)"
            onClick={(e) => e.stopPropagation()}
          >
            <VStack gap={4}>
              <Box w="64px" h="64px" borderRadius="pill" bg="#ECFDF5" display="flex" alignItems="center" justifyContent="center">
                <Text fontSize="3xl">✓</Text>
              </Box>
              <Text fontSize="sm" fontWeight="700" color="#64748B" textTransform="uppercase" letterSpacing="0.05em">
                A sua senha
              </Text>
              <Text fontSize={{ base: '6xl', md: '7xl' }} fontWeight="800" color="#0A192F" lineHeight="1">
                {emitted.number}
              </Text>
              <Badge bg="#EFF6FF" color="#1565C0" borderRadius="pill" px={4} py={1.5} fontSize="md" fontWeight="700">
                {emitted.serviceName}
              </Badge>
              <Text fontSize="sm" color="ink.muted">
                Aguarde pela chamada da sua senha. Bom atendimento!
              </Text>
              <Button
                mt={2}
                colorPalette="blue"
                borderRadius="10px"
                px={10}
                h={12}
                fontWeight="700"
                onClick={() => setEmitted(null)}
              >
                Concluir
              </Button>
            </VStack>
          </Box>
        </Box>
      )}
    </Box>
  );
}
