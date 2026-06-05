// Admin — Indicators Report with date range picker

import { useState, useEffect } from 'react';
import { Heading, Text, VStack, Button, Card, SimpleGrid, Table, Flex, Input } from '@chakra-ui/react';
import { getIndicatorsForRange } from '../../api/indicators';
import { useNotificationStore } from '../../store/notification-store';
import type { RangeIndicators } from '../../api/indicators';

export default function Indicators() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<RangeIndicators | null>(null);
  const [loading, setLoading] = useState(false);
  const notify = useNotificationStore();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getIndicatorsForRange(startDate, endDate);
      setData(result);
    } catch {
      notify.addNotification({ type: 'error', title: 'Erro ao carregar indicadores' });
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <VStack gap={6} align="stretch">
      <Heading size="lg">Indicadores e Relatórios</Heading>

      <Flex gap={4} align="flex-end">
        <VStack align="stretch" gap={1}>
          <Text fontSize="sm" fontWeight="medium">Data Início</Text>
          <Input type="date" value={startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)} />
        </VStack>
        <VStack align="stretch" gap={1}>
          <Text fontSize="sm" fontWeight="medium">Data Fim</Text>
          <Input type="date" value={endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)} />
        </VStack>
        <Button colorPalette="teal" loading={loading} onClick={loadData}>Gerar Relatório</Button>
      </Flex>

      {data && (
        <>
          <SimpleGrid columns={4} gap={4}>
            <Card.Root p={6}>
              <VStack align="center" gap={2}>
                <Text color="gray.500" fontSize="sm">Senhas Emitidas</Text>
                <Heading size="3xl" color="teal.600">{data.summary.issued}</Heading>
              </VStack>
            </Card.Root>
            <Card.Root p={6}>
              <VStack align="center" gap={2}>
                <Text color="gray.500" fontSize="sm">Senhas Atendidas</Text>
                <Heading size="3xl" color="green.600">{data.summary.served}</Heading>
              </VStack>
            </Card.Root>
            <Card.Root p={6}>
              <VStack align="center" gap={2}>
                <Text color="gray.500" fontSize="sm">Tempo Médio Espera</Text>
                <Heading size="3xl" color="orange.600">{data.summary.avgWaitMin} min</Heading>
              </VStack>
            </Card.Root>
            <Card.Root p={6}>
              <VStack align="center" gap={2}>
                <Text color="gray.500" fontSize="sm">Tempo Médio Atendimento</Text>
                <Heading size="3xl" color="blue.600">{data.summary.avgServiceMin} min</Heading>
              </VStack>
            </Card.Root>
          </SimpleGrid>

          <Card.Root p={6}>
            <Heading size="md" mb={4}>Detalhamento Diário</Heading>
            {data.daily.length === 0 ? (
              <Text color="gray.500">Sem dados para o período seleccionado.</Text>
            ) : (
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Data</Table.ColumnHeader>
                    <Table.ColumnHeader>Emitidas</Table.ColumnHeader>
                    <Table.ColumnHeader>Atendidas</Table.ColumnHeader>
                    <Table.ColumnHeader>Canceladas</Table.ColumnHeader>
                    <Table.ColumnHeader>Não Compareceu</Table.ColumnHeader>
                    <Table.ColumnHeader>Espera Média</Table.ColumnHeader>
                    <Table.ColumnHeader>Atend. Médio</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data.daily.map((day) => (
                    <Table.Row key={day.date}>
                      <Table.Cell>{new Date(day.date).toLocaleDateString('pt')}</Table.Cell>
                      <Table.Cell>{day.issued}</Table.Cell>
                      <Table.Cell>{day.served}</Table.Cell>
                      <Table.Cell>{day.cancelled}</Table.Cell>
                      <Table.Cell>{day.noShow}</Table.Cell>
                      <Table.Cell>{day.avgWaitMin} min</Table.Cell>
                      <Table.Cell>{day.avgServiceMin} min</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Card.Root>
        </>
      )}
    </VStack>
  );
}
