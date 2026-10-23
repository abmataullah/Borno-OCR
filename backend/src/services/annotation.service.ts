import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import type { Annotation } from '../db/schema';

export class AnnotationService {
  async listByProject(userId: string, projectId: string): Promise<Annotation[]> {
    return db
      .select()
      .from(schema.annotations)
      .where(
        and(
          eq(schema.annotations.projectId, projectId),
          eq(schema.annotations.userId, userId)
        )
      )
      .orderBy(desc(schema.annotations.createdAt));
  }

  async listByPage(
    userId: string,
    projectId: string,
    pageIndex: number
  ): Promise<Annotation[]> {
    return db
      .select()
      .from(schema.annotations)
      .where(
        and(
          eq(schema.annotations.projectId, projectId),
          eq(schema.annotations.userId, userId),
          eq(schema.annotations.pageIndex, pageIndex)
        )
      )
      .orderBy(desc(schema.annotations.createdAt));
  }

  async create(
    userId: string,
    projectId: string,
    data: {
      pageIndex: number;
      annotationType?: string;
      content?: string;
      bbox?: Record<string, unknown>;
      color?: string;
    }
  ): Promise<Annotation> {
    const [annotation] = await db
      .insert(schema.annotations)
      .values({
        userId,
        projectId,
        pageIndex: data.pageIndex,
        annotationType: data.annotationType ?? 'note',
        content: data.content,
        bbox: data.bbox,
        color: data.color ?? '#d4af37',
      })
      .returning();
    return annotation;
  }

  async update(
    userId: string,
    annotationId: string,
    data: Partial<{
      content: string;
      bbox: Record<string, unknown>;
      color: string;
      resolved: boolean;
    }>
  ): Promise<Annotation | null> {
    const [updated] = await db
      .update(schema.annotations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.annotations.id, annotationId),
          eq(schema.annotations.userId, userId)
        )
      )
      .returning();
    return updated ?? null;
  }

  async delete(userId: string, annotationId: string): Promise<boolean> {
    const result = await db
      .delete(schema.annotations)
      .where(
        and(
          eq(schema.annotations.id, annotationId),
          eq(schema.annotations.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }
}

export const annotationService = new AnnotationService();
