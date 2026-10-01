import { z } from 'zod';

export const ProductDtoSchema = z
  .object({
    id: z.string().min(1, 'El id del producto es obligatorio'),
  })
  .passthrough();

export type ProductDto = z.infer<typeof ProductDtoSchema>;

export const BatchDtoSchema = z
  .object({
    id: z.string().min(1, 'El id del lote es obligatorio'),
    productId: z.string().min(1, 'El productId del lote es obligatorio'),
  })
  .passthrough();

export type BatchDto = z.infer<typeof BatchDtoSchema>;

export const ReplaceInventoryDtoSchema = z.object({
  products: z.array(ProductDtoSchema),
  batches: z.array(BatchDtoSchema),
});

export type ReplaceInventoryDto = z.infer<typeof ReplaceInventoryDtoSchema>;

export const BatchProductsDtoSchema = z.object({
  products: z.array(ProductDtoSchema),
});

export type BatchProductsDto = z.infer<typeof BatchProductsDtoSchema>;
