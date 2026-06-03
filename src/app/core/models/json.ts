import * as M from './models';

function asEnum<T extends string>(values: readonly T[], raw: any, fallback: T): T {
  return values.includes(raw) ? (raw as T) : fallback;
}

function parseDate(value: any): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'number') return new Date(value);
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1_000_000));
    }
    if (typeof value._seconds === 'number') {
      return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1_000_000));
    }
    if (typeof value.toDate === 'function') {
      try { return value.toDate(); } catch { /* */ }
    }
  }
  return new Date(NaN);
}

function parseDateOrNull(value: any): Date | null {
  if (value == null) return null;
  const d = parseDate(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const Enums = {
  bandRoleValues: ['admin', 'member', 'readOnly'] as const,
  inviteStatusValues: ['pending', 'accepted', 'declined'] as const,
  contactTypeValues: ['venue', 'promoter', 'photographer', 'videographer', 'studio', 'graphicDesigner', 'merchPrinting', 'transport', 'other'] as const,
  songStatusValues: ['idea', 'demo', 'mixMaster', 'releaseReady', 'rehearsalReady', 'liveReady', 'released'] as const,
  releaseTypeValues: ['single', 'ep', 'lp'] as const,
  eventTypeValues: ['rehearsal', 'show', 'recording', 'meeting', 'release', 'other'] as const,
  taskStatusValues: ['todo', 'inProgress', 'done'] as const,
  taskPriorityValues: ['low', 'medium', 'high'] as const,
  currencyValues: ['eur', 'ron', 'usd', 'gbp'] as const,
  expenseCategoryValues: ['travel', 'fuel', 'venueOrRehearsalRoom', 'gear', 'studio', 'marketing', 'merchPrinting', 'foodOrHospitality', 'other'] as const,
  incomeSourceValues: ['showFee', 'merchSale', 'streamingOrRoyalties', 'sessionWork', 'sponsorship', 'other'] as const,
  merchMovementTypeValues: ['stockAdded', 'stockSold'] as const,
  planValues: ['free', 'premium'] as const,
  premiumStatusValues: ['active', 'expired', 'canceled', 'grace', 'refunded'] as const,
  premiumSourceValues: ['test', 'googlePlay', 'appStore', 'manual', 'lifetime'] as const,
};

export const AuthUserJson = {
  toJson(u: M.AuthUser): any {
    return {
      id: u.id, email: u.email, displayName: u.displayName, emailVerified: u.emailVerified,
      createdAt: u.createdAt.toISOString(), lastVerificationEmailAt: u.lastVerificationEmailAt?.toISOString() ?? null,
    };
  },
  fromJson(json: any): M.AuthUser {
    return {
      id: json.id, email: json.email, displayName: json.displayName,
      emailVerified: !!json.emailVerified,
      createdAt: parseDate(json.createdAt),
      lastVerificationEmailAt: parseDateOrNull(json.lastVerificationEmailAt),
    };
  },
};

export const MemberJson = {
  toJson(m: M.BandMember): any { return { userId: m.userId, displayName: m.displayName, role: m.role, email: m.email ?? null }; },
  fromJson(j: any): M.BandMember {
    return {
      userId: j.userId, displayName: j.displayName,
      role: asEnum(Enums.bandRoleValues, j.role, 'member') as M.BandRole,
      email: j.email ?? null,
    };
  },
};

export const InviteJson = {
  toJson(i: M.BandInvite): any {
    return {
      id: i.id, displayName: i.displayName, email: i.email, role: i.role, status: i.status,
      createdAt: i.createdAt.toISOString(), lastSentAt: i.lastSentAt?.toISOString() ?? null,
      requestedUserId: i.requestedUserId ?? null,
    };
  },
  fromJson(j: any): M.BandInvite {
    return {
      id: j.id, displayName: j.displayName, email: j.email,
      role: asEnum(Enums.bandRoleValues, j.role, 'member') as M.BandRole,
      status: asEnum(Enums.inviteStatusValues, j.status, 'pending') as M.BandInviteStatus,
      createdAt: parseDate(j.createdAt),
      lastSentAt: parseDateOrNull(j.lastSentAt),
      requestedUserId: j.requestedUserId ?? null,
    };
  },
};

export const ContactJson = {
  toJson(c: M.BandContact): any {
    return { id: c.id, name: c.name, type: c.type, phone: c.phone, email: c.email, notes: c.notes };
  },
  fromJson(j: any): M.BandContact {
    return {
      id: j.id, name: j.name,
      type: asEnum(Enums.contactTypeValues, j.type, 'other') as M.BandContactType,
      phone: j.phone ?? '', email: j.email ?? '', notes: j.notes ?? '',
    };
  },
};

export const SongJson = {
  toJson(s: M.Song): any {
    return {
      id: s.id, title: s.title, tuning: s.tuning, bpm: s.bpm, duration: s.duration,
      timeSignature: s.timeSignature, sortOrder: s.sortOrder, status: s.status,
      lyrics: s.lyrics, notes: s.notes, attachmentLabel: s.attachmentLabel ?? null,
      releaseId: s.releaseId ?? null, audioUrl: s.audioUrl ?? null,
      audioStoragePath: s.audioStoragePath ?? null, audioFileName: s.audioFileName ?? null,
      audioContentType: s.audioContentType ?? null, audioSizeBytes: s.audioSizeBytes ?? null,
      audioUploadedAt: s.audioUploadedAt?.toISOString() ?? null,
      audioUploadedByUid: s.audioUploadedByUid ?? null,
      key: s.key ?? null, difficulty: s.difficulty ?? null,
      lastPlayedAt: s.lastPlayedAt?.toISOString() ?? null,
      playCount: s.playCount ?? null,
      updatedAt: s.updatedAt.toISOString(),
    };
  },
  fromJson(j: any): M.Song {
    return {
      id: j.id, title: j.title, tuning: j.tuning, bpm: Number(j.bpm),
      duration: j.duration, timeSignature: j.timeSignature ?? '4/4', sortOrder: Number(j.sortOrder ?? 0),
      status: asEnum(Enums.songStatusValues, j.status, 'idea') as M.SongStatus,
      lyrics: j.lyrics ?? '', notes: j.notes ?? '', attachmentLabel: j.attachmentLabel ?? null,
      releaseId: j.releaseId ?? null, audioUrl: j.audioUrl ?? null,
      audioStoragePath: j.audioStoragePath ?? null, audioFileName: j.audioFileName ?? null,
      audioContentType: j.audioContentType ?? null,
      audioSizeBytes: j.audioSizeBytes != null ? Number(j.audioSizeBytes) : null,
      audioUploadedAt: parseDateOrNull(j.audioUploadedAt),
      audioUploadedByUid: j.audioUploadedByUid ?? null,
      key: j.key ?? undefined,
      difficulty: j.difficulty != null ? Number(j.difficulty) : undefined,
      lastPlayedAt: parseDateOrNull(j.lastPlayedAt),
      playCount: j.playCount != null ? Number(j.playCount) : undefined,
      updatedAt: parseDate(j.updatedAt),
    };
  },
};

export const ReleaseJson = {
  toJson(r: M.SongRelease): any {
    return {
      id: r.id, title: r.title, type: r.type,
      releaseDate: r.releaseDate?.toISOString() ?? null,
      notes: r.notes, updatedAt: r.updatedAt.toISOString(),
    };
  },
  fromJson(j: any): M.SongRelease {
    return {
      id: j.id, title: j.title,
      type: asEnum(Enums.releaseTypeValues, j.type, 'single') as M.SongReleaseType,
      releaseDate: parseDateOrNull(j.releaseDate),
      notes: j.notes ?? '', updatedAt: parseDate(j.updatedAt),
    };
  },
};

export const EventJson = {
  toJson(e: M.BandEvent): any {
    return {
      id: e.id, title: e.title, type: e.type,
      startAt: e.startAt.toISOString(), location: e.location, notes: e.notes,
      checklist: e.checklist.map(c => ({ label: c.label, isDone: c.isDone })),
    };
  },
  fromJson(j: any): M.BandEvent {
    let typeRaw = j.type;
    if (typeRaw === 'contentShoot') typeRaw = 'other';
    if (typeRaw === 'admin') typeRaw = 'meeting';
    return {
      id: j.id, title: j.title,
      type: asEnum(Enums.eventTypeValues, typeRaw, 'other') as M.BandEventType,
      startAt: parseDate(j.startAt), location: j.location ?? '', notes: j.notes ?? '',
      checklist: ((j.checklist as any[]) ?? []).map(c => ({ label: c.label, isDone: !!c.isDone })),
    };
  },
};

export const TaskJson = {
  toJson(t: M.BandTask): any {
    return {
      id: t.id, title: t.title, description: t.description,
      assigneeDisplayName: t.assigneeDisplayName,
      dueDate: t.dueDate?.toISOString() ?? null,
      status: t.status, priority: t.priority,
      songId: t.songId ?? null,
      createdByUid: t.createdByUid ?? null, assigneeUid: t.assigneeUid ?? null,
      updatedAt: t.updatedAt?.toISOString() ?? null,
    };
  },
  fromJson(j: any): M.BandTask {
    return {
      id: j.id, title: j.title, description: j.description ?? '',
      assigneeDisplayName: j.assigneeDisplayName ?? '',
      dueDate: parseDateOrNull(j.dueDate),
      status: asEnum(Enums.taskStatusValues, j.status, 'todo') as M.BandTaskStatus,
      priority: asEnum(Enums.taskPriorityValues, j.priority, 'medium') as M.BandTaskPriority,
      songId: j.songId ?? null,
      createdByUid: j.createdByUid ?? null, assigneeUid: j.assigneeUid ?? null,
      updatedAt: parseDateOrNull(j.updatedAt),
    };
  },
};

export const SetlistItemJson = {
  toJson(it: M.BandSetlistItem): any {
    return {
      id: it.id, songId: it.songId, songTitle: it.songTitle, songDuration: it.songDuration,
      order: it.order, breakAfterSeconds: it.breakAfterSeconds, breakAfterNotes: it.breakAfterNotes,
    };
  },
  fromJson(j: any): M.BandSetlistItem {
    return {
      id: j.id, songId: j.songId, songTitle: j.songTitle ?? '',
      songDuration: j.songDuration ?? '0:00', order: Number(j.order ?? 0),
      breakAfterSeconds: Number(j.breakAfterSeconds ?? 0),
      breakAfterNotes: j.breakAfterNotes ?? '',
    };
  },
};

export const SetlistJson = {
  toJson(s: M.BandSetlist): any {
    return {
      id: s.id, title: s.title,
      items: [...s.items].sort((a, b) => a.order - b.order).map(SetlistItemJson.toJson),
      notes: s.notes, updatedAt: s.updatedAt.toISOString(),
    };
  },
  fromJson(j: any): M.BandSetlist {
    const items = ((j.items as any[]) ?? []).map(SetlistItemJson.fromJson).sort((a, b) => a.order - b.order);
    return {
      id: j.id, title: j.title, items,
      notes: j.notes ?? '', updatedAt: parseDate(j.updatedAt),
    };
  },
};

export const RiderInputJson = {
  toJson(r: M.TechnicalRiderInput): any {
    return {
      id: r.id, sourceName: r.sourceName, channelNumber: r.channelNumber,
      micDiPreference: r.micDiPreference, standType: r.standType,
      phantomPower: r.phantomPower ?? null, stagePosition: r.stagePosition, notes: r.notes,
    };
  },
  fromJson(j: any): M.TechnicalRiderInput {
    return {
      id: j.id, sourceName: j.sourceName ?? '',
      channelNumber: j.channelNumber ?? '', micDiPreference: j.micDiPreference ?? '',
      standType: j.standType ?? '', phantomPower: j.phantomPower ?? null,
      stagePosition: j.stagePosition ?? '', notes: j.notes ?? '',
    };
  },
};

export const RiderJson = {
  toJson(r: M.TechnicalRider): any {
    return {
      id: r.id, riderName: r.riderName, bandName: r.bandName, contactPerson: r.contactPerson,
      phone: r.phone, email: r.email, lineup: r.lineup, shortNote: r.shortNote,
      updatedAt: r.updatedAt.toISOString(),
      stageWidth: r.stageWidth, stageDepth: r.stageDepth, memberPositions: r.memberPositions,
      instrumentPositions: r.instrumentPositions, ampPositions: r.ampPositions,
      monitorPositions: r.monitorPositions, powerDropNotes: r.powerDropNotes,
      inputList: r.inputList.map(RiderInputJson.toJson),
      bandBackline: r.bandBackline, venueBackline: r.venueBackline,
      usesIem: r.usesIem ?? null, wedgesNeeded: r.wedgesNeeded ?? null,
      monitorMixCount: r.monitorMixCount, playbackClickNotes: r.playbackClickNotes,
      powerRequirements: r.powerRequirements, outletLocationNotes: r.outletLocationNotes,
      additionalNotes: r.additionalNotes,
    };
  },
  fromJson(j: any): M.TechnicalRider {
    return {
      id: j.id, riderName: j.riderName ?? '', bandName: j.bandName ?? '', contactPerson: j.contactPerson ?? '',
      phone: j.phone ?? '', email: j.email ?? '', lineup: j.lineup ?? '', shortNote: j.shortNote ?? '',
      updatedAt: j.updatedAt ? parseDate(j.updatedAt) : new Date(),
      stageWidth: j.stageWidth ?? '', stageDepth: j.stageDepth ?? '',
      memberPositions: j.memberPositions ?? '', instrumentPositions: j.instrumentPositions ?? '',
      ampPositions: j.ampPositions ?? '', monitorPositions: j.monitorPositions ?? '',
      powerDropNotes: j.powerDropNotes ?? '',
      inputList: ((j.inputList as any[]) ?? []).map(RiderInputJson.fromJson),
      bandBackline: j.bandBackline ?? '', venueBackline: j.venueBackline ?? '',
      usesIem: j.usesIem ?? null, wedgesNeeded: j.wedgesNeeded ?? null,
      monitorMixCount: j.monitorMixCount ?? '', playbackClickNotes: j.playbackClickNotes ?? '',
      powerRequirements: j.powerRequirements ?? '', outletLocationNotes: j.outletLocationNotes ?? '',
      additionalNotes: j.additionalNotes ?? '',
    };
  },
};

export const ExpenseJson = {
  toJson(e: M.FinanceExpense): any {
    return {
      id: e.id, title: e.title, amount: e.amount, date: e.date.toISOString(), category: e.category,
      paidBy: e.paidBy, notes: e.notes, linkedEventId: e.linkedEventId ?? null,
      linkedMerchItemId: e.linkedMerchItemId ?? null, linkedMerchMovementId: e.linkedMerchMovementId ?? null,
      linkedMerchQuantity: e.linkedMerchQuantity ?? null,
    };
  },
  fromJson(j: any): M.FinanceExpense {
    const rawCategory = j.category === 'printing' ? 'merchPrinting' : j.category;
    return {
      id: j.id, title: j.title, amount: Number(j.amount ?? 0),
      date: parseDate(j.date),
      category: asEnum(Enums.expenseCategoryValues, rawCategory, 'other') as M.FinanceExpenseCategory,
      paidBy: j.paidBy ?? '', notes: j.notes ?? '',
      linkedEventId: j.linkedEventId ?? null,
      linkedMerchItemId: j.linkedMerchItemId ?? null,
      linkedMerchMovementId: j.linkedMerchMovementId ?? null,
      linkedMerchQuantity: j.linkedMerchQuantity != null ? Number(j.linkedMerchQuantity) : null,
    };
  },
};

export const IncomeJson = {
  toJson(i: M.FinanceIncome): any {
    return {
      id: i.id, title: i.title, amount: i.amount, date: i.date.toISOString(), source: i.source,
      receivedBy: i.receivedBy, notes: i.notes, linkedEventId: i.linkedEventId ?? null,
      linkedMerchItemId: i.linkedMerchItemId ?? null, linkedMerchMovementId: i.linkedMerchMovementId ?? null,
      linkedMerchQuantity: i.linkedMerchQuantity ?? null,
    };
  },
  fromJson(j: any): M.FinanceIncome {
    return {
      id: j.id, title: j.title, amount: Number(j.amount ?? 0),
      date: parseDate(j.date),
      source: asEnum(Enums.incomeSourceValues, j.source, 'other') as M.FinanceIncomeSource,
      receivedBy: j.receivedBy ?? '', notes: j.notes ?? '',
      linkedEventId: j.linkedEventId ?? null,
      linkedMerchItemId: j.linkedMerchItemId ?? null,
      linkedMerchMovementId: j.linkedMerchMovementId ?? null,
      linkedMerchQuantity: j.linkedMerchQuantity != null ? Number(j.linkedMerchQuantity) : null,
    };
  },
};

export const MerchMovementJson = {
  toJson(m: M.MerchMovement): any {
    return {
      id: m.id, type: m.type, quantity: m.quantity, date: m.date.toISOString(), notes: m.notes,
      linkedEventId: m.linkedEventId ?? null, linkedExpenseId: m.linkedExpenseId ?? null,
      linkedIncomeId: m.linkedIncomeId ?? null,
    };
  },
  fromJson(j: any): M.MerchMovement {
    return {
      id: j.id,
      type: asEnum(Enums.merchMovementTypeValues, j.type, 'stockAdded') as M.MerchMovementType,
      quantity: Number(j.quantity ?? 0), date: parseDate(j.date), notes: j.notes ?? '',
      linkedEventId: j.linkedEventId ?? null, linkedExpenseId: j.linkedExpenseId ?? null,
      linkedIncomeId: j.linkedIncomeId ?? null,
    };
  },
};

export const MerchItemJson = {
  toJson(m: M.MerchItem): any {
    return {
      id: m.id, itemName: m.itemName, quantity: m.quantity, unitPrice: m.unitPrice,
      unitCost: m.unitCost ?? null, notes: m.notes,
      movements: m.movements.map(MerchMovementJson.toJson),
    };
  },
  fromJson(j: any): M.MerchItem {
    return {
      id: j.id, itemName: j.itemName, quantity: Number(j.quantity ?? 0),
      unitPrice: Number(j.unitPrice ?? 0),
      unitCost: j.unitCost != null ? Number(j.unitCost) : null,
      notes: j.notes ?? '',
      movements: ((j.movements as any[]) ?? []).map(MerchMovementJson.fromJson),
    };
  },
};

export const EntitlementJson = {
  toJson(e: M.WorkspacePremiumEntitlement): any {
    return {
      status: e.status, source: e.source, productId: e.productId ?? null,
      premiumUntil: e.premiumUntil?.toISOString() ?? null, isLifetime: e.isLifetime,
      purchasedByUid: e.purchasedByUid ?? null,
      lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
      updatedAt: e.updatedAt.toISOString(),
    };
  },
  fromJson(j: any): M.WorkspacePremiumEntitlement {
    return {
      status: asEnum(Enums.premiumStatusValues, j.status, 'expired') as M.WorkspacePremiumStatus,
      source: asEnum(Enums.premiumSourceValues, j.source, 'manual') as M.WorkspacePremiumSource,
      productId: j.productId ?? null,
      premiumUntil: parseDateOrNull(j.premiumUntil),
      isLifetime: !!j.isLifetime, purchasedByUid: j.purchasedByUid ?? null,
      lastVerifiedAt: parseDateOrNull(j.lastVerifiedAt),
      updatedAt: parseDateOrNull(j.updatedAt) ?? new Date(),
    };
  },
};

export const WorkspaceJson = {
  toJson(w: M.BandWorkspace): any {
    return {
      id: w.id, bandName: w.bandName, genre: w.genre, inviteCode: w.inviteCode,
      plan: M.entitlementHasPremiumAccess(w.premiumEntitlement) ? 'premium' : 'free',
      billing: w.premiumEntitlement ? EntitlementJson.toJson(w.premiumEntitlement) : null,
      currency: w.currency, currentUserId: w.currentUserId,
      members: w.members.map(MemberJson.toJson),
      songs: w.songs.map(SongJson.toJson),
      events: w.events.map(EventJson.toJson),
      tasks: w.tasks.map(TaskJson.toJson),
      contacts: w.contacts.map(ContactJson.toJson),
      releases: w.releases.map(ReleaseJson.toJson),
      technicalRiders: w.technicalRiders.map(RiderJson.toJson),
      expenses: w.expenses.map(ExpenseJson.toJson),
      incomes: w.incomes.map(IncomeJson.toJson),
      merchItems: w.merchItems.map(MerchItemJson.toJson),
      setlists: w.setlists.map(SetlistJson.toJson),
      setlistsCount: w.setlists.length, contactsCount: w.contacts.length,
      monthSpendEur: w.monthSpendEur, releaseMilestoneLabel: w.releaseMilestoneLabel,
      updatedAt: w.updatedAt.toISOString(),
      pendingInvites: w.pendingInvites.map(InviteJson.toJson),
      logoUrl: w.logoUrl ?? null, logoStoragePath: w.logoStoragePath ?? null,
    };
  },
  fromJson(j: any): M.BandWorkspace {
    const billing = j.billing && typeof j.billing === 'object' ? EntitlementJson.fromJson(j.billing) : null;
    const plan: M.WorkspacePlan = M.entitlementHasPremiumAccess(billing) ? M.WorkspacePlan.premium : M.WorkspacePlan.free;
    const contacts = ((j.contacts as any[]) ?? []).map(ContactJson.fromJson);
    const setlists = ((j.setlists as any[]) ?? []).map(SetlistJson.fromJson).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return {
      id: j.id, bandName: j.bandName, genre: j.genre, inviteCode: j.inviteCode,
      plan, premiumEntitlement: billing,
      currency: asEnum(Enums.currencyValues, j.currency, 'eur') as M.WorkspaceCurrency,
      currentUserId: j.currentUserId,
      members: (j.members as any[]).map(MemberJson.fromJson),
      songs: (j.songs as any[]).map(SongJson.fromJson),
      events: ((j.events as any[]) ?? []).map(EventJson.fromJson),
      tasks: ((j.tasks as any[]) ?? []).map(TaskJson.fromJson),
      contacts,
      releases: ((j.releases as any[]) ?? []).map(ReleaseJson.fromJson),
      technicalRiders: ((j.technicalRiders as any[]) ?? []).map(RiderJson.fromJson),
      expenses: ((j.expenses as any[]) ?? []).map(ExpenseJson.fromJson),
      incomes: ((j.incomes as any[]) ?? []).map(IncomeJson.fromJson),
      merchItems: ((j.merchItems as any[]) ?? []).map(MerchItemJson.fromJson),
      setlists,
      setlistsCount: setlists.length || Number(j.setlistsCount ?? 0),
      contactsCount: contacts.length,
      monthSpendEur: Number(j.monthSpendEur ?? 0),
      releaseMilestoneLabel: j.releaseMilestoneLabel ?? '',
      updatedAt: parseDateOrNull(j.updatedAt) ?? new Date(),
      pendingInvites: ((j.pendingInvites as any[]) ?? []).map(InviteJson.fromJson),
      logoUrl: j.logoUrl ?? null, logoStoragePath: j.logoStoragePath ?? null,
    };
  },
};
