import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProductDto, BatchDto } from './inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getInventory(): Promise<{ products: any[]; batches: any[] }> {
    const [prodRows, batchRows] = await Promise.all([
      this.databaseService.query<{ data: any }>(
        'SELECT data FROM public.products ORDER BY updated_at DESC',
      ),
      this.databaseService.query<{ data: any }>(
        'SELECT data FROM public.batches ORDER BY updated_at DESC',
      ),
    ]);

    return {
      products: (prodRows || []).map((r) => r.data),
      batches: (batchRows || []).map((r) => r.data),
    };
  }

  async createProduct(product: ProductDto): Promise<any> {
    const sql = `
      INSERT INTO public.products (id, data, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()
      RETURNING data
    `;
    const rows = await this.databaseService.query<{ data: any }>(sql, [
      product.id,
      JSON.stringify(product),
    ]);
    return rows[0].data;
  }

  async updateProduct(id: string, product: ProductDto): Promise<any> {
    const payload = { ...product, id };
    const sql = `
      UPDATE public.products
      SET data = $1, updated_at = now()
      WHERE id = $2
      RETURNING data
    `;
    const rows = await this.databaseService.query<{ data: any }>(sql, [
      JSON.stringify(payload),
      id,
    ]);
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return rows[0].data;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query('DELETE FROM public.batches WHERE product_id = $1', [id]);
      const res = await client.query(
        'DELETE FROM public.products WHERE id = $1 RETURNING id',
        [id],
      );
      if (res.rowCount === 0) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }
      return true;
    });
  }

  async upsertProductsBatch(products: ProductDto[]): Promise<boolean> {
    if (!products || products.length === 0) return true;
    return this.databaseService.withTransaction(async (client) => {
      const sql = `
        INSERT INTO public.products (id, data, updated_at)
        VALUES ($1, $2, now())
        ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = now()
      `;
      for (const p of products) {
        await client.query(sql, [p.id, JSON.stringify(p)]);
      }
      return true;
    });
  }

  async createBatch(batch: BatchDto): Promise<any> {
    const productId = batch.productId;
    const sql = `
      INSERT INTO public.batches (id, product_id, data, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (id) DO UPDATE SET product_id = $2, data = $3, updated_at = now()
      RETURNING data
    `;
    const rows = await this.databaseService.query<{ data: any }>(sql, [
      batch.id,
      productId,
      JSON.stringify(batch),
    ]);
    return rows[0].data;
  }

  async deleteBatch(id: string): Promise<boolean> {
    const rows = await this.databaseService.query(
      'DELETE FROM public.batches WHERE id = $1 RETURNING id',
      [id],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Lote con ID ${id} no encontrado`);
    }
    return true;
  }

  async replaceInventory(
    products: ProductDto[],
    batches: BatchDto[],
  ): Promise<{ products: number; batches: number }> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query('DELETE FROM public.batches');
      await client.query('DELETE FROM public.products');

      const insertProdSql = `
        INSERT INTO public.products (id, data, updated_at)
        VALUES ($1, $2, now())
      `;
      for (const p of products) {
        await client.query(insertProdSql, [p.id, JSON.stringify(p)]);
      }

      if (batches && batches.length > 0) {
        const insertBatchSql = `
          INSERT INTO public.batches (id, product_id, data, updated_at)
          VALUES ($1, $2, $3, now())
        `;
        for (const b of batches) {
          await client.query(insertBatchSql, [b.id, b.productId, JSON.stringify(b)]);
        }
      }

      return {
        products: products.length,
        batches: batches.length,
      };
    });
  }
}
