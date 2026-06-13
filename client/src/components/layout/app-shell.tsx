// AppShell — sidebar + header layout for admin, management, root

import { Box, Flex, Text, IconButton, VStack, HStack, Badge, Separator } from '@chakra-ui/react';
import { useAuthStore } from '../../store/auth-store';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout as apiLogout } from '../../api/auth';

interface SidebarItem {
  label: string;
  path: string;
  icon?: string;
}

const SIDEBAR_ITEMS: Record<string, SidebarItem[]> = {
  root: [
    { label: 'Administradores', path: '/root/admins', icon: '👤' },
    { label: 'Minha Conta', path: '/root/account', icon: '🔒' },
  ],
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: '◆' },
    { label: 'Utilizadores', path: '/admin/users', icon: '👥' },
    { label: 'Áreas', path: '/admin/areas', icon: '📁' },
    { label: 'Serviços', path: '/admin/services', icon: '🏥' },
    { label: 'Estações', path: '/admin/stations', icon: '🖥' },
    { label: 'Displays', path: '/admin/displays', icon: '📺' },
    { label: 'Dispensadores', path: '/admin/dispensers', icon: '📱' },
    { label: 'Gestão de Senhas', path: '/admin/tickets', icon: '🎫' },
    { label: 'Indicadores', path: '/admin/indicators', icon: '📊' },
    { label: 'Configurações', path: '/admin/settings', icon: '⚙️' },
    { label: 'Backup de Dados', path: '/admin/backup', icon: '💾' },
    { label: 'Minha Conta', path: '/admin/account', icon: '🔒' },
  ],
  management: [
    { label: 'Dashboard', path: '/management/dashboard', icon: '◆' },
    { label: 'Anúncios', path: '/management/ads', icon: '📢' },
    { label: 'Config. Senha', path: '/management/ticket-format', icon: '🎫' },
    { label: 'Config. Voz', path: '/management/voice', icon: '🔊' },
    { label: 'Minha Conta', path: '/management/account', icon: '🔒' },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  root: 'Super Admin',
  admin: 'Administrador',
  reception: 'Recepção',
  management: 'Marketing',
  display: 'Display',
  dispenser: 'Dispensador',
};

const ROLE_COLORS: Record<string, string> = {
  root: '#7C3AED',
  admin: '#1565C0',
  reception: '#059669',
  management: '#D97706',
  display: '#6B7280',
  dispenser: '#4B5563',
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const authStore = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const role = authStore.user?.role || 'admin';
  const items = SIDEBAR_ITEMS[role] || [];

  return (
    <Flex h="100vh" direction="row" bg="surface.DEFAULT" fontFamily="body">
      {/* Sidebar */}
      <Box
        w="260px"
        bg="brand.800"
        color="white"
        overflowY="auto"
        py={6}
        px={4}
        display="flex"
        flexDirection="column"
        flexShrink={0}
      >
        {/* Logo */}
        <VStack gap={1} align="start" mb={8} px={2}>
          <HStack gap={3} align="center">
            <img
              src="/logo-katondo.png"
              alt="Clínica Katondo Logo"
              style={{ height: '40px', objectFit: 'contain' }}
            />
            <VStack gap={0} align="start">
              <Text fontSize="10px" color="whiteAlpha.500" letterSpacing="0.08em" fontWeight="500">
                GESTÃO DE FILAS
              </Text>
            </VStack>
          </HStack>
        </VStack>

        {/* Navigation */}
        <VStack gap={1} align="stretch" flex={1}>
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={item.path}
                px={3}
                py={2.5}
                rounded="10px"
                cursor="pointer"
                bg={isActive ? 'whiteAlpha.100' : 'transparent'}
                borderLeft={isActive ? '3px solid' : '3px solid transparent'}
                borderColor={isActive ? 'emerald.400' : 'transparent'}
                _hover={{ bg: 'whiteAlpha.50' }}
                onClick={() => navigate(item.path)}
                fontSize="sm"
                fontWeight={isActive ? '600' : '400'}
                color={isActive ? 'white' : 'whiteAlpha.700'}
                transition="all 0.15s ease"
                display="flex"
                alignItems="center"
                gap={3}
              >
                <Text fontSize="sm" opacity={0.7}>{item.icon}</Text>
                <Text>{item.label}</Text>
              </Box>
            );
          })}
        </VStack>

        {/* Footer */}
        <VStack gap={2} mt={6} px={2} align="start">
          <Separator borderColor="whiteAlpha.100" />
          <Text fontSize="10px" color="whiteAlpha.400">
            © {new Date().getFullYear()} Toque Media, Lda
          </Text>
          <Text fontSize="10px" color="whiteAlpha.300">
            Talatona, Luanda — Angola
          </Text>
        </VStack>
      </Box>

      {/* Main content */}
      <Box flex={1} overflowY="auto" display="flex" flexDirection="column">
        {/* Header */}
        <Flex
          px={8}
          py={4}
          bg="surface.elevated"
          borderBottom="1px solid"
          borderColor="blackAlpha.50"
          justify="space-between"
          align="center"
          flexShrink={0}
        >
          <HStack gap={3}>
            <Text fontFamily="heading" fontSize="xl" fontWeight="400" color="brand.700">
              Painel de Gestão
            </Text>
          </HStack>

          <HStack gap={4} align="center">
            <Badge
              px={3}
              py={1}
              borderRadius="8px"
              fontSize="xs"
              fontWeight="600"
              bg={`${ROLE_COLORS[role]}15`}
              color={ROLE_COLORS[role]}
              border={`1px solid ${ROLE_COLORS[role]}30`}
            >
              {ROLE_LABELS[role] || role}
            </Badge>
            <HStack gap={2} align="center">
              <Box
                w="32px"
                h="32px"
                borderRadius="full"
                bg="brand.100"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="sm" fontWeight="600" color="brand.600">
                  {authStore.user?.username?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </Box>
              <Text fontSize="sm" fontWeight="500" color="ink.DEFAULT">
                {authStore.user?.username}
              </Text>
            </HStack>
            <IconButton
              size="sm"
              variant="ghost"
              aria-label="Sair"
              onClick={async () => {
                try {
                  await apiLogout();
                } catch (e) {
                  console.error('Logout API failed', e);
                }
                authStore.logout();
                navigate('/login');
              }}
              color="ink.muted"
              _hover={{ color: 'brand.600', bg: 'brand.50' }}
            >
              🚪
            </IconButton>
          </HStack>
        </Flex>

        {/* Page content */}
        <Box p={8} flex={1}>
          {children}
        </Box>
      </Box>
    </Flex>
  );
}
