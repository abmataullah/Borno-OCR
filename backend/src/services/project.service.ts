import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { Project, NewProject } from '../db/schema';

export class ProjectService {
  async create(userId: string, data: Omit<NewProject, 'userId'>): Promise<Project> {
    const [project] = await db
      .insert(schema.projects)
      .values({ ...data, userId })
      .returning();
    return project;
  }

  async getById(userId: string, projectId: string): Promise<Project | null> {
    const result = await db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
      .limit(1);
    return result[0] ?? null;
  }

  async listByUser(userId: string, limit = 50, offset = 0): Promise<Project[]> {
    const result = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.userId, userId))
      .orderBy(desc(schema.projects.updatedAt))
      .limit(limit)
      .offset(offset);
    return result;
  }

  async search(userId: string, query: string, limit = 20, offset = 0): Promise<Project[]> {
    const pattern = `%${query}%`;
    const result = await db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.userId, userId),
          or(
            ilike(schema.projects.name, pattern),
            sql`project_data::text ILIKE ${pattern}`
          )
        )
      )
      .orderBy(desc(schema.projects.updatedAt))
      .limit(limit)
      .offset(offset);
    return result;
  }

  async update(userId: string, projectId: string, data: Partial<NewProject>): Promise<Project | null> {
    const [updated] = await db
      .update(schema.projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(userId: string, projectId: string): Promise<boolean> {
    const result = await db
      .delete(schema.projects)
      .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async getByShareToken(shareToken: string): Promise<Project | null> {
    const result = await db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.shareToken, shareToken), eq(schema.projects.isShared, true)))
      .limit(1);
    return result[0] ?? null;
  }

  async generateShareToken(userId: string, projectId: string, isShared: boolean): Promise<Project | null> {
    const shareToken = isShared ? crypto.randomUUID() : null;
    return this.update(userId, projectId, { isShared, shareToken });
  }
}

export const projectService = new ProjectService();
