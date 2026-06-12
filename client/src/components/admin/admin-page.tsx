import { Box, Card, Flex, Heading, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function AdminPageHeader({ title, description, action }: AdminPageHeaderProps) {
  return (
    <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={4}>
      <Box>
        <Heading size="lg" color="brand.700">{title}</Heading>
        {description && (
          <Text color="gray.600" fontSize="sm" mt={1}>{description}</Text>
        )}
      </Box>
      {action && (
        <Box alignSelf={{ base: 'stretch', md: 'center' }}>
          {action}
        </Box>
      )}
    </Flex>
  );
}

export function AdminSectionCard({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Card.Root
      bg={muted ? 'surface.muted' : 'white'}
      borderRadius="10px"
      border="1px solid"
      borderColor="blackAlpha.100"
      shadow="sm"
      overflow="hidden"
    >
      <Card.Body p={0}>{children}</Card.Body>
    </Card.Root>
  );
}

export function AdminTableCard({ children }: { children: ReactNode }) {
  return (
    <AdminSectionCard>
      <Box overflowX="auto">{children}</Box>
    </AdminSectionCard>
  );
}
