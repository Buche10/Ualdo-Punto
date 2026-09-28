import { describe, it, expect } from 'vitest';
import { AppController } from '../app.controller';

describe('AppController (/api/health)', () => {
  const controller = new AppController();

  it('debe responder con estado ok y metadata de salud del backend', () => {
    const response = controller.getHealth();
    expect(response.status).toBe('ok');
    expect(response.service).toBe('pharmastock-sri-backend');
    expect(response.timestamp).toBeDefined();
    expect(response.ambiente).toBeDefined();
  });
});
