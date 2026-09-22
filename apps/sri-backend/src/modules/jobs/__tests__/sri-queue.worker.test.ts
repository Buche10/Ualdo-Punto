import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SriQueueWorker } from '../sri-queue.worker';

describe('SriQueueWorker (Reclamo Atómico y Rescate de Jobs Colgados)', () => {
  let worker: SriQueueWorker;
  let mockProcessor: any;
  let mockRepository: any;

  beforeEach(() => {
    mockProcessor = {
      procesarJob: vi.fn().mockResolvedValue({ exito: true }),
    };

    mockRepository = {
      rescatarJobsColgados: vi.fn().mockResolvedValue(2),
      obtenerJobsPendientes: vi.fn().mockResolvedValue([]),
      reclamarJobPorId: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
    };

    worker = new SriQueueWorker(mockProcessor as any, mockRepository as any);
  });

  it('debe ejecutar rescatarJobsColgados al inicio de cada ciclo de la cola', async () => {
    await worker.procesarColaPendiente();

    expect(mockRepository.rescatarJobsColgados).toHaveBeenCalledWith(10);
    expect(mockRepository.obtenerJobsPendientes).toHaveBeenCalled();
  });

  it('debe reclamar atómicamente el job en despacharInmediato y procesarlo solo si el reclamo tuvo éxito', async () => {
    mockRepository.reclamarJobPorId.mockResolvedValueOnce(true);

    await worker.despacharInmediato({
      id: 'job-1',
      comprobanteId: 'comp-1',
      claveAcceso: '2209202601179001691900110010010000000011234567818',
      xmlFirmado: '<xml/>',
    });

    // Esperar setImmediate
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockRepository.reclamarJobPorId).toHaveBeenCalledWith('job-1');
    expect(mockProcessor.procesarJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' })
    );
  });

  it('debe ABORTAR despacharInmediato si el cron ya reclamó el job (reclamarJobPorId retorna false)', async () => {
    mockRepository.reclamarJobPorId.mockResolvedValueOnce(false); // Ya tomado por el cron

    await worker.despacharInmediato({
      id: 'job-1',
      comprobanteId: 'comp-1',
      claveAcceso: '2209202601179001691900110010010000000011234567818',
      xmlFirmado: '<xml/>',
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockRepository.reclamarJobPorId).toHaveBeenCalledWith('job-1');
    expect(mockProcessor.procesarJob).not.toHaveBeenCalled();
  });
});
