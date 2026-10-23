import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { PLANS, type PlanId, type Plan } from '../config/plans';

export interface GatewayConfig {
  enabled: boolean;
  secretKey?: string;
  appKey?: string;
  appSecret?: string;
  username?: string;
  password?: string;
  storeId?: string;
  storePasswd?: string;
  baseUrl?: string;
}

export interface AppSettingsData {
  gateways: {
    stripe: GatewayConfig;
    bkash: GatewayConfig;
    sslcommerz: GatewayConfig;
  };
  planOverrides: Partial<Record<PlanId, { priceUsd?: number; priceBdt?: number }>>;
}

const SETTINGS_ID = 'global';

const DEFAULT_SETTINGS: AppSettingsData = {
  gateways: {
    stripe: { enabled: false },
    bkash: { enabled: false },
    sslcommerz: { enabled: false },
  },
  planOverrides: {},
};

function deepMerge<T>(base: T, patch: Partial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const patchVal = (patch as Record<string, unknown>)[key];
    const baseVal = (base as Record<string, unknown>)[key];
    if (
      patchVal &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(baseVal, patchVal);
    } else if (patchVal !== undefined) {
      result[key] = patchVal;
    }
  }
  return result as T;
}

export class SettingsService {
  async getSettings(): Promise<AppSettingsData> {
    const [row] = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, SETTINGS_ID))
      .limit(1);

    if (!row) {
      await db.insert(schema.appSettings).values({ id: SETTINGS_ID, data: DEFAULT_SETTINGS });
      return DEFAULT_SETTINGS;
    }

    return deepMerge(DEFAULT_SETTINGS, (row.data as Partial<AppSettingsData>) ?? {});
  }

  async updateSettings(patch: Partial<AppSettingsData>): Promise<AppSettingsData> {
    const current = await this.getSettings();
    const merged = deepMerge(current, patch);

    await db
      .insert(schema.appSettings)
      .values({ id: SETTINGS_ID, data: merged, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.appSettings.id,
        set: { data: merged, updatedAt: new Date() },
      });

    return merged;
  }

  /** Get the gateway config, preferring DB overrides over env vars. */
  async getGatewayConfig(provider: 'stripe' | 'bkash' | 'sslcommerz'): Promise<GatewayConfig> {
    const settings = await this.getSettings();
    return settings.gateways[provider];
  }

  /** Merge plan overrides on top of the static PLANS config. */
  async getEffectivePlans(): Promise<Record<PlanId, Plan>> {
    const settings = await this.getSettings();
    const result = { ...PLANS };
    for (const planId of Object.keys(settings.planOverrides) as PlanId[]) {
      const override = settings.planOverrides[planId];
      if (!override) continue;
      result[planId] = {
        ...result[planId],
        priceUsd: override.priceUsd ?? result[planId].priceUsd,
        priceBdt: override.priceBdt ?? result[planId].priceBdt,
      };
    }
    return result;
  }

  async getEffectivePlanPrice(planId: PlanId, currency: 'USD' | 'BDT'): Promise<number> {
    const plans = await this.getEffectivePlans();
    return currency === 'USD' ? plans[planId].priceUsd : plans[planId].priceBdt;
  }
}

export const settingsService = new SettingsService();
