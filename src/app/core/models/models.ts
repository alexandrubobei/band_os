// Domain models ported from lib/src/core/models/*.dart

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date;
  lastVerificationEmailAt?: Date | null;
}

export interface SignUpDraft {
  displayName: string;
  email: string;
  password: string;
}

export enum BandRole { admin = 'admin', member = 'member', readOnly = 'readOnly' }
export const BandRoleLabel: Record<BandRole, string> = {
  [BandRole.admin]: 'Admin',
  [BandRole.member]: 'Member',
  [BandRole.readOnly]: 'Read-only',
};

export enum WorkspacePlan { free = 'free', premium = 'premium' }
export const WorkspacePlanLabel: Record<WorkspacePlan, string> = {
  [WorkspacePlan.free]: 'Free',
  [WorkspacePlan.premium]: 'Premium',
};

export enum WorkspacePremiumStatus { active = 'active', expired = 'expired', canceled = 'canceled', grace = 'grace', refunded = 'refunded' }
export enum WorkspacePremiumSource { test = 'test', googlePlay = 'googlePlay', appStore = 'appStore', manual = 'manual', lifetime = 'lifetime' }

export interface WorkspacePremiumProductSpec {
  key: WorkspacePremiumProduct;
  title: string;
  priceLabel: string;
  accessLabel: string;
  productId: string;
  badge?: string;
  isLifetime: boolean;
  addMonths?: number;
}

export enum WorkspacePremiumProduct {
  monthly = 'monthly', threeMonths = 'threeMonths', sixMonths = 'sixMonths', yearly = 'yearly', lifetime = 'lifetime',
}

export const PremiumProductCatalog: Record<WorkspacePremiumProduct, WorkspacePremiumProductSpec> = {
  [WorkspacePremiumProduct.monthly]: { key: WorkspacePremiumProduct.monthly, title: 'Monthly', priceLabel: '€9.99', accessLabel: '1 month access', productId: 'bandos_premium_monthly', isLifetime: false, addMonths: 1 },
  [WorkspacePremiumProduct.threeMonths]: { key: WorkspacePremiumProduct.threeMonths, title: '3 months', priceLabel: '€24.99', accessLabel: '3 months access', productId: 'bandos_premium_3_months', isLifetime: false, addMonths: 3 },
  [WorkspacePremiumProduct.sixMonths]: { key: WorkspacePremiumProduct.sixMonths, title: '6 months', priceLabel: '€44.99', accessLabel: '6 months access', productId: 'bandos_premium_6_months', isLifetime: false, addMonths: 6 },
  [WorkspacePremiumProduct.yearly]: { key: WorkspacePremiumProduct.yearly, title: 'Yearly', priceLabel: '€79.99', accessLabel: '1 year access', productId: 'bandos_premium_yearly', badge: 'Best value', isLifetime: false, addMonths: 12 },
  [WorkspacePremiumProduct.lifetime]: { key: WorkspacePremiumProduct.lifetime, title: 'Lifetime', priceLabel: '€199.99', accessLabel: 'One-time purchase', productId: 'bandos_premium_lifetime', badge: 'Lifetime', isLifetime: true },
};

export const SelectablePremiumPlans: WorkspacePremiumProduct[] = [
  WorkspacePremiumProduct.monthly,
  WorkspacePremiumProduct.threeMonths,
  WorkspacePremiumProduct.sixMonths,
  WorkspacePremiumProduct.yearly,
];

export interface WorkspacePremiumEntitlement {
  status: WorkspacePremiumStatus;
  source: WorkspacePremiumSource;
  productId?: string | null;
  premiumUntil?: Date | null;
  isLifetime: boolean;
  purchasedByUid?: string | null;
  lastVerifiedAt?: Date | null;
  updatedAt: Date;
}

export function entitlementHasPremiumAccess(entitlement: WorkspacePremiumEntitlement | null | undefined, nowUtc: Date = new Date()): boolean {
  if (!entitlement) return false;
  if (entitlement.status === WorkspacePremiumStatus.refunded) return false;
  if (entitlement.isLifetime) return true;
  const okStatus = [WorkspacePremiumStatus.active, WorkspacePremiumStatus.canceled, WorkspacePremiumStatus.grace].includes(entitlement.status);
  if (!okStatus) return false;
  if (!entitlement.premiumUntil) return false;
  return entitlement.premiumUntil.getTime() > nowUtc.getTime();
}

export function premiumUntilFrom(productKey: WorkspacePremiumProduct, nowUtc: Date): Date | null {
  const spec = PremiumProductCatalog[productKey];
  if (spec.isLifetime) return null;
  if (!spec.addMonths) return null;
  return addUtcMonths(nowUtc, spec.addMonths);
}

export function addUtcMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonthIndex = d.getUTCMonth() + months;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(d.getUTCDate(), lastDayOfTarget);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()));
}

export function makeTestPremiumEntitlement(product: WorkspacePremiumProduct, purchasedByUid: string, now?: Date): WorkspacePremiumEntitlement {
  const nowUtc = now ?? new Date();
  const spec = PremiumProductCatalog[product];
  return {
    status: WorkspacePremiumStatus.active,
    source: WorkspacePremiumSource.test,
    productId: spec.productId,
    premiumUntil: premiumUntilFrom(product, nowUtc),
    isLifetime: spec.isLifetime,
    purchasedByUid,
    lastVerifiedAt: nowUtc,
    updatedAt: nowUtc,
  };
}

export interface BandMember {
  userId: string;
  displayName: string;
  role: BandRole;
  email?: string | null;
  assignedColor?: string; // Hex color for presence indicators (e.g., #FF6B6B)
}

export function memberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export enum BandInviteStatus { pending = 'pending', accepted = 'accepted', declined = 'declined' }
export const BandInviteStatusLabel: Record<BandInviteStatus, string> = {
  [BandInviteStatus.pending]: 'Pending', [BandInviteStatus.accepted]: 'Accepted', [BandInviteStatus.declined]: 'Declined',
};

export interface BandInvite {
  id: string;
  displayName: string;
  email: string;
  role: BandRole;
  status: BandInviteStatus;
  createdAt: Date;
  lastSentAt?: Date | null;
  requestedUserId?: string | null;
}

export function inviteIsJoinRequest(invite: BandInvite): boolean {
  return invite.requestedUserId != null;
}

export enum BandContactType {
  venue = 'venue', promoter = 'promoter', photographer = 'photographer', videographer = 'videographer',
  studio = 'studio', graphicDesigner = 'graphicDesigner', merchPrinting = 'merchPrinting', transport = 'transport', other = 'other',
}
export const BandContactTypeLabel: Record<BandContactType, string> = {
  [BandContactType.venue]: 'Venue', [BandContactType.promoter]: 'Promoter', [BandContactType.photographer]: 'Photographer',
  [BandContactType.videographer]: 'Videographer', [BandContactType.studio]: 'Studio', [BandContactType.graphicDesigner]: 'Graphic designer',
  [BandContactType.merchPrinting]: 'Merch / printing', [BandContactType.transport]: 'Transport', [BandContactType.other]: 'Other',
};

export interface BandContact {
  id: string;
  name: string;
  type: BandContactType;
  phone: string;
  email: string;
  notes: string;
}

export function contactInitials(name: string): string {
  return memberInitials(name);
}

export enum SongStatus {
  idea = 'idea', demo = 'demo', mixMaster = 'mixMaster', releaseReady = 'releaseReady',
  rehearsalReady = 'rehearsalReady', liveReady = 'liveReady', released = 'released',
}
export const SongStatusLabel: Record<SongStatus, string> = {
  [SongStatus.idea]: 'Idea', [SongStatus.demo]: 'Demo', [SongStatus.mixMaster]: 'Mix/Master',
  [SongStatus.releaseReady]: 'Release ready', [SongStatus.rehearsalReady]: 'Rehearsal ready',
  [SongStatus.liveReady]: 'Live ready', [SongStatus.released]: 'Released',
};

export interface Song {
  id: string;
  title: string;
  tuning: string;
  bpm: number;
  duration: string;
  timeSignature: string;
  sortOrder: number;
  status: SongStatus;
  lyrics: string;
  notes: string;
  attachmentLabel?: string | null;
  releaseId?: string | null;
  audioUrl?: string | null;
  audioStoragePath?: string | null;
  audioFileName?: string | null;
  audioContentType?: string | null;
  audioSizeBytes?: number | null;
  audioUploadedAt?: Date | null;
  audioUploadedByUid?: string | null;
  updatedAt: Date;
  // New fields for performance tracking and enrichment
  key?: string; // Musical key (C, D, E, Am, etc.)
  difficulty?: number; // 1-5 scale for learning/playing difficulty
  lastPlayedAt?: Date | null; // When song was last in a performed setlist
  playCount?: number; // Total times performed
}

export function songHasAudio(song: Song): boolean {
  return !!(song.audioUrl && song.audioUrl.trim().length > 0);
}

export function songMatchesQuery(song: Song, query: string): boolean {
  const value = query.trim().toLowerCase();
  if (!value) return true;
  const titleWords = song.title.toLowerCase().split(/\s+/).filter(Boolean);
  return titleWords.some(w => w.startsWith(value)) ||
    song.tuning.toLowerCase().includes(value) ||
    song.notes.toLowerCase().includes(value);
}

export enum SongReleaseType { single = 'single', ep = 'ep', lp = 'lp' }
export const SongReleaseTypeLabel: Record<SongReleaseType, string> = { single: 'Single', ep: 'EP', lp: 'LP' };

export interface SongRelease {
  id: string;
  title: string;
  type: SongReleaseType;
  releaseDate?: Date | null;
  notes: string;
  updatedAt: Date;
}

export enum BandEventType {
  rehearsal = 'rehearsal', show = 'show', recording = 'recording',
  meeting = 'meeting', release = 'release', other = 'other',
}
export const BandEventTypeLabel: Record<BandEventType, string> = {
  rehearsal: 'Rehearsal', show: 'Show', recording: 'Recording', meeting: 'Meeting', release: 'Release', other: 'Other',
};

export interface EventChecklistItem { label: string; isDone: boolean; }

export interface BandEvent {
  id: string;
  title: string;
  type: BandEventType;
  startAt: Date;
  location: string;
  notes: string;
  checklist: EventChecklistItem[];
  // New fields for setlist tracking
  linkedSetlistId?: string | null; // Which setlist was performed at this event
  performedAt?: Date | null; // When performance actually occurred (may differ from startAt)
}

export function eventOpenChecklistCount(e: BandEvent): number {
  return e.checklist.filter(i => !i.isDone).length;
}

export enum BandTaskStatus { todo = 'todo', inProgress = 'inProgress', done = 'done' }
export const BandTaskStatusLabel: Record<BandTaskStatus, string> = { todo: 'To do', inProgress: 'In progress', done: 'Done' };

export enum BandTaskPriority { low = 'low', medium = 'medium', high = 'high' }
export const BandTaskPriorityLabel: Record<BandTaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export interface BandTask {
  id: string;
  title: string;
  description: string;
  assigneeDisplayName: string;
  dueDate: Date | null;
  status: BandTaskStatus;
  priority: BandTaskPriority;
  songId: string | null;
  createdByUid?: string | null;
  assigneeUid?: string | null;
  updatedAt?: Date | null;
  // New field for rich task display
  assigneeUser?: BandMember; // Full member object for display
}

export interface BandSetlistItem {
  id: string;
  songId: string;
  songTitle: string;
  songDuration: string;
  order: number;
  breakAfterSeconds: number;
  breakAfterNotes: string;
}

export interface BandSetlist {
  id: string;
  title: string;
  items: BandSetlistItem[];
  notes: string;
  updatedAt: Date;
  // New fields for performance tracking and display
  performanceCount?: number; // How many times this setlist was performed
  lastPerformedAt?: Date | null; // When this setlist was last performed
  totalDuration?: string; // Pre-calculated total duration (cached for UI)
}

export function parseBandDurationToSeconds(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  const parts = raw.split(':').map(s => s.trim());
  if (parts.length !== 2 && parts.length !== 3) return 0;
  if (parts.some(p => !p)) return 0;
  const numbers = parts.map(p => Number.parseInt(p, 10));
  if (numbers.some(n => Number.isNaN(n))) return 0;
  if (parts.length === 2) {
    const [m, s] = numbers;
    if (s >= 60) return 0;
    return m * 60 + s;
  }
  const [h, m, s] = numbers;
  if (m >= 60 || s >= 60) return 0;
  return h * 3600 + m * 60 + s;
}

export function formatBandDurationFromSeconds(totalSeconds: number): string {
  const t = totalSeconds < 0 ? 0 : totalSeconds;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function setlistTotals(setlist: BandSetlist) {
  const ordered = [...setlist.items].sort((a, b) => a.order - b.order);
  const songSeconds = ordered.reduce((sum, it) => sum + parseBandDurationToSeconds(it.songDuration), 0);
  const breakSeconds = ordered.reduce((sum, it) => sum + (it.breakAfterSeconds || 0), 0);
  return {
    ordered,
    songSeconds,
    breakSeconds,
    totalSeconds: songSeconds + breakSeconds,
    totalLabel: formatBandDurationFromSeconds(songSeconds + breakSeconds),
    breakLabel: formatBandDurationFromSeconds(breakSeconds),
  };
}

export interface TechnicalRiderInput {
  id: string;
  sourceName: string;
  channelNumber: string;
  micDiPreference: string;
  standType: string;
  phantomPower?: boolean | null;
  stagePosition: string;
  notes: string;
}

export interface TechnicalRider {
  id: string;
  riderName: string;
  bandName: string;
  contactPerson: string;
  phone: string;
  email: string;
  lineup: string;
  shortNote: string;
  updatedAt: Date;
  stageWidth: string;
  stageDepth: string;
  memberPositions: string;
  instrumentPositions: string;
  ampPositions: string;
  monitorPositions: string;
  powerDropNotes: string;
  inputList: TechnicalRiderInput[];
  bandBackline: string;
  venueBackline: string;
  usesIem?: boolean | null;
  wedgesNeeded?: boolean | null;
  monitorMixCount: string;
  playbackClickNotes: string;
  powerRequirements: string;
  outletLocationNotes: string;
  additionalNotes: string;
}

export enum WorkspaceCurrency { eur = 'eur', ron = 'ron', usd = 'usd', gbp = 'gbp' }
export const WorkspaceCurrencyCode: Record<WorkspaceCurrency, string> = { eur: 'EUR', ron: 'RON', usd: 'USD', gbp: 'GBP' };

export enum FinanceExpenseCategory {
  travel = 'travel', fuel = 'fuel', venueOrRehearsalRoom = 'venueOrRehearsalRoom', gear = 'gear',
  studio = 'studio', marketing = 'marketing', merchPrinting = 'merchPrinting', foodOrHospitality = 'foodOrHospitality', other = 'other',
}
export const FinanceExpenseCategoryLabel: Record<FinanceExpenseCategory, string> = {
  travel: 'Travel', fuel: 'Fuel', venueOrRehearsalRoom: 'Venue / rehearsal room', gear: 'Gear',
  studio: 'Studio', marketing: 'Marketing', merchPrinting: 'Merch / printing', foodOrHospitality: 'Food / hospitality', other: 'Other',
};

export enum FinanceIncomeSource {
  showFee = 'showFee', merchSale = 'merchSale', streamingOrRoyalties = 'streamingOrRoyalties',
  sessionWork = 'sessionWork', sponsorship = 'sponsorship', other = 'other',
}
export const FinanceIncomeSourceLabel: Record<FinanceIncomeSource, string> = {
  showFee: 'Show fee', merchSale: 'Merch sale', streamingOrRoyalties: 'Streaming / royalties',
  sessionWork: 'Session work', sponsorship: 'Sponsorship', other: 'Other',
};

export interface FinanceExpense {
  id: string;
  title: string;
  amount: number;
  date: Date;
  category: FinanceExpenseCategory;
  paidBy: string;
  notes: string;
  linkedEventId?: string | null;
  linkedMerchItemId?: string | null;
  linkedMerchMovementId?: string | null;
  linkedMerchQuantity?: number | null;
}

export interface FinanceIncome {
  id: string;
  title: string;
  amount: number;
  date: Date;
  source: FinanceIncomeSource;
  receivedBy: string;
  notes: string;
  linkedEventId?: string | null;
  linkedMerchItemId?: string | null;
  linkedMerchMovementId?: string | null;
  linkedMerchQuantity?: number | null;
}

export enum MerchMovementType { stockAdded = 'stockAdded', stockSold = 'stockSold' }
export const MerchMovementTypeLabel: Record<MerchMovementType, string> = { stockAdded: 'Stock added', stockSold: 'Stock sold' };

export interface MerchMovement {
  id: string;
  type: MerchMovementType;
  quantity: number;
  date: Date;
  notes: string;
  linkedEventId?: string | null;
  linkedExpenseId?: string | null;
  linkedIncomeId?: string | null;
}

export interface MerchItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number | null;
  notes: string;
  movements: MerchMovement[];
}

export function merchStockOnHand(item: MerchItem): number {
  const added = item.movements.filter(m => m.type === MerchMovementType.stockAdded).reduce((s, m) => s + m.quantity, 0);
  const sold = item.movements.filter(m => m.type === MerchMovementType.stockSold).reduce((s, m) => s + m.quantity, 0);
  return item.quantity + added - sold;
}

export interface PendingWorkspaceAccess {
  workspaceId: string;
  bandName: string;
  genre: string;
  inviteCode: string;
  inviteId: string;
  status: BandInviteStatus;
  alreadyPending?: boolean;
}

export interface BandWorkspace {
  id: string;
  bandName: string;
  genre: string;
  inviteCode: string;
  plan: WorkspacePlan;
  premiumEntitlement?: WorkspacePremiumEntitlement | null;
  currency: WorkspaceCurrency;
  currentUserId: string;
  members: BandMember[];
  songs: Song[];
  events: BandEvent[];
  tasks: BandTask[];
  contacts: BandContact[];
  releases: SongRelease[];
  technicalRiders: TechnicalRider[];
  expenses: FinanceExpense[];
  incomes: FinanceIncome[];
  merchItems: MerchItem[];
  setlists: BandSetlist[];
  setlistsCount: number;
  contactsCount: number;
  monthSpendEur: number;
  releaseMilestoneLabel: string;
  updatedAt: Date;
  pendingInvites: BandInvite[];
  logoUrl?: string | null;
  logoStoragePath?: string | null;
}

export function wsCurrentMember(ws: BandWorkspace): BandMember | undefined {
  return ws.members.find(m => m.userId === ws.currentUserId);
}
export function wsCurrentRole(ws: BandWorkspace): BandRole {
  return wsCurrentMember(ws)?.role ?? BandRole.readOnly;
}
export function wsCanManageMembers(ws: BandWorkspace): boolean { return wsCurrentRole(ws) === BandRole.admin; }
export function wsCanEditContent(ws: BandWorkspace): boolean { return wsCurrentRole(ws) !== BandRole.readOnly; }
export function wsAdminCount(ws: BandWorkspace): number { return ws.members.filter(m => m.role === BandRole.admin).length; }
export function wsIsLastAdmin(ws: BandWorkspace): boolean { return wsCurrentRole(ws) === BandRole.admin && wsAdminCount(ws) <= 1; }
export function wsIsPremium(ws: BandWorkspace): boolean { return entitlementHasPremiumAccess(ws.premiumEntitlement); }
export function wsIsFree(ws: BandWorkspace): boolean { return !wsIsPremium(ws); }
export function wsSupportsRiders(ws: BandWorkspace): boolean { return wsIsPremium(ws); }
export function wsSupportsFinances(ws: BandWorkspace): boolean { return wsIsPremium(ws); }
export function wsSupportsReleases(ws: BandWorkspace): boolean { return wsIsPremium(ws); }
export function wsSupportsUnlimitedSetlists(ws: BandWorkspace): boolean { return wsIsPremium(ws); }
export function wsMaxMembers(ws: BandWorkspace): number { return wsIsPremium(ws) ? 999999 : 4; }
export function wsMaxSongs(ws: BandWorkspace): number { return wsIsPremium(ws) ? 999999 : 6; }
export function wsMaxSetlists(ws: BandWorkspace): number { return wsIsPremium(ws) ? 999999 : 1; }
export function wsHasReachedMemberLimit(ws: BandWorkspace): boolean { return ws.members.length >= wsMaxMembers(ws); }
export function wsHasReachedSongLimit(ws: BandWorkspace): boolean { return ws.songs.length >= wsMaxSongs(ws); }
export function wsHasReachedSetlistLimit(ws: BandWorkspace): boolean { return ws.setlists.length >= wsMaxSetlists(ws); }
export function wsCanSaveSetlist(ws: BandWorkspace, setlistId?: string): boolean {
  if (wsSupportsUnlimitedSetlists(ws)) return true;
  if (setlistId && ws.setlists.some(s => s.id === setlistId)) return true;
  return ws.setlists.length < wsMaxSetlists(ws);
}
export function wsCurrentPlanLabel(ws: BandWorkspace): string { return wsIsPremium(ws) ? 'Premium' : 'Free'; }
export function wsOpenTasksCount(ws: BandWorkspace): number { return ws.tasks.filter(t => t.status !== BandTaskStatus.done).length; }
export function wsNextShow(ws: BandWorkspace): BandEvent | undefined {
  const now = new Date();
  return [...ws.events]
    .filter(e => e.type === BandEventType.show && e.startAt.getTime() >= now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
}
export function wsUpcomingEvents(ws: BandWorkspace): BandEvent[] {
  const now = new Date();
  return [...ws.events].filter(e => e.startAt.getTime() >= now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
export function wsHasFinancialData(ws: BandWorkspace): boolean { return ws.expenses.length > 0 || ws.incomes.length > 0 || ws.merchItems.length > 0; }
export function wsHasReleaseData(ws: BandWorkspace): boolean {
  return ws.releases.length > 0 || ws.songs.some(s => (s.releaseId ?? '').trim().length > 0);
}
function isSameMonth(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
export function wsIncomeThisMonth(ws: BandWorkspace): number {
  const now = new Date();
  return ws.incomes.filter(i => isSameMonth(i.date, now)).reduce((s, i) => s + i.amount, 0);
}
export function wsExpensesThisMonth(ws: BandWorkspace): number {
  const now = new Date();
  return ws.expenses.filter(e => isSameMonth(e.date, now)).reduce((s, e) => s + e.amount, 0);
}
export function wsNetThisMonth(ws: BandWorkspace): number { return wsIncomeThisMonth(ws) - wsExpensesThisMonth(ws); }

export enum UpgradeTarget {
  workspacePlan = 'workspacePlan', members = 'members', songs = 'songs', setlists = 'setlists',
  technicalRiders = 'technicalRiders', finances = 'finances', releases = 'releases',
}

export enum JoinWorkspaceOutcome {
  joinedWorkspace = 'joinedWorkspace', pendingApproval = 'pendingApproval',
  requestSubmittedWhileInWorkspace = 'requestSubmittedWhileInWorkspace', requestAlreadyPending = 'requestAlreadyPending',
}

export interface ActionResult {
  isSuccess: boolean;
  message: string;
  upgradeTarget?: UpgradeTarget;
  joinWorkspaceOutcome?: JoinWorkspaceOutcome;
}

export const ActionResult = {
  success(message: string): ActionResult { return { isSuccess: true, message }; },
  failure(message: string, opts?: { upgradeTarget?: UpgradeTarget; joinWorkspaceOutcome?: JoinWorkspaceOutcome }): ActionResult {
    return { isSuccess: false, message, ...opts };
  },
  joinSuccess(message: string, outcome: JoinWorkspaceOutcome): ActionResult {
    return { isSuccess: true, message, joinWorkspaceOutcome: outcome };
  },
};

// ─── Messaging ───────────────────────────────────────────────
export type ConversationKind = 'channel' | 'dm';

/** A band-wide chat channel (e.g. #general). */
export interface ChatChannel {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  createdAt: Date;
  createdBy: string;
  /** Monotonic counter — never decremented — used for cheap unread math. */
  messageCount: number;
  lastMessageAt?: Date | null;
  lastMessageText?: string | null;
  lastMessageBy?: string | null;
}

/** A 1:1 direct-message conversation between two members. */
export interface DmConversation {
  id: string;            // deterministic, sorted "uidA__uidB"
  participants: string[];
  createdAt: Date;
  messageCount: number;
  lastMessageAt?: Date | null;
  lastMessageText?: string | null;
  lastMessageBy?: string | null;
}

/** A single chat message in a channel or DM. */
export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
  editedAt?: Date | null;
  /** emoji -> list of userIds who reacted with it. */
  reactions?: Record<string, string[]>;
}

/** Deterministic DM conversation id from two user ids (order-independent). */
export function dmConversationId(a: string, b: string): string {
  return [a, b].sort().join('__');
}
