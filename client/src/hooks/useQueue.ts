// Queue hook — call-next, start, complete, recall, no-show

import { useState } from 'react';
import { callNext, startService, completeService, markNoShow, recallTicket } from '../api/tickets';
import { useQueueStore } from '../store/queue-store';
import { useNotificationStore } from '../store/notification-store';

export function useQueue(areaId: number, stationId: number) {
  const [loading, setLoading] = useState(false);
  const queueStore = useQueueStore();
  const notify = useNotificationStore();

  const handleCallNext = async () => {
    setLoading(true);
    try {
      const result = await callNext(areaId, stationId);
      queueStore.setCurrentTicket(result.ticket);
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao chamar próxima senha' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartService = async (ticketId: number) => {
    setLoading(true);
    try {
      const result = await startService(ticketId);
      queueStore.updateTicket(result.ticket);
      notify.addNotification({ type: 'success', title: 'Atendimento iniciado' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao iniciar' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteService = async (ticketId: number) => {
    setLoading(true);
    try {
      await completeService(ticketId);
      queueStore.setCurrentTicket(null);
      notify.addNotification({ type: 'success', title: 'Atendimento concluído' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao concluir' });
    } finally {
      setLoading(false);
    }
  };

  const handleNoShow = async (ticketId: number) => {
    setLoading(true);
    try {
      await markNoShow(ticketId);
      queueStore.setCurrentTicket(null);
      notify.addNotification({ type: 'success', title: 'Senha descartada' });
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao descartar' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async (ticketId: number) => {
    setLoading(true);
    try {
      const result = await recallTicket(ticketId);
      queueStore.updateTicket(result.ticket);
    } catch (err: any) {
      notify.addNotification({ type: 'error', title: err.response?.data?.error || 'Erro ao chamar novamente' });
    } finally {
      setLoading(false);
    }
  };

  const canCallNext = queueStore.currentTicket === null;

  return {
    loading,
    handleCallNext,
    handleStartService,
    handleCompleteService,
    handleNoShow,
    handleRecall,
    canCallNext,
  };
}
