import * as M from '../models/models';

export const DEMO_INVITE_CODE = 'DEMO-128';
export const DEMO_BAND_NAME = 'Demo Band';
export const DEMO_GENRE = 'heavy alternative';

export function buildDemoWorkspace(opts: {
  workspaceId: string;
  currentUserId: string;
  adminDisplayName: string;
  bandName?: string;
  genre?: string;
  invite?: string;
}): M.BandWorkspace {
  const bandName = opts.bandName ?? DEMO_BAND_NAME;
  const genre = opts.genre ?? DEMO_GENRE;
  const invite = opts.invite ?? DEMO_INVITE_CODE;
  const entitlement = M.makeTestPremiumEntitlement(M.WorkspacePremiumProduct.yearly, opts.currentUserId, new Date(Date.UTC(2026, 3, 10, 10)));
  return {
    id: opts.workspaceId,
    bandName, genre, inviteCode: invite,
    plan: M.WorkspacePlan.premium,
    premiumEntitlement: entitlement,
    currency: M.WorkspaceCurrency.eur,
    currentUserId: opts.currentUserId,
    members: [
      { userId: opts.currentUserId, displayName: opts.adminDisplayName, role: M.BandRole.admin, email: 'demo@bandos.example' },
      { userId: 'seed-orion-pike', displayName: 'Orion Pike', role: M.BandRole.member, email: 'orion@example-band.test' },
      { userId: 'seed-juno-slate', displayName: 'Juno Slate', role: M.BandRole.member, email: 'juno@example-band.test' },
      { userId: 'seed-kai-mercer', displayName: 'Kai Mercer', role: M.BandRole.readOnly, email: 'kai@example-band.test' },
    ],
    songs: [
      { id: 'song-signal-fade', title: 'Signal Fade', tuning: 'Drop C', bpm: 168, duration: '3:48', timeSignature: '4/4', sortOrder: 0, status: M.SongStatus.liveReady, lyrics: '', notes: 'Needs cleaner transition into final breakdown.', attachmentLabel: 'Demo mix', updatedAt: new Date(2026, 3, 10) },
      { id: 'song-northbound-echo', title: 'Northbound Echo', tuning: 'Drop B', bpm: 154, duration: '4:12', timeSignature: '4/4', sortOrder: 1, status: M.SongStatus.mixMaster, lyrics: '', notes: 'Keep half-time chorus feel.', attachmentLabel: 'Riff folder', updatedAt: new Date(2026, 3, 9) },
      { id: 'song-glass-lantern', title: 'Glass Lantern', tuning: 'D standard', bpm: 132, duration: '3:22', timeSignature: '4/4', sortOrder: 2, status: M.SongStatus.rehearsalReady, lyrics: '', notes: 'Works as opener if intro sample lands.', updatedAt: new Date(2026, 3, 8) },
    ],
    events: [
      { id: 'event-tighten-bridge', title: 'Tighten new bridge sections', type: M.BandEventType.rehearsal, startAt: new Date(2026, 3, 11, 22, 2), location: 'Room 4, Demo Rehearsal Space', notes: 'Bring click track exports and spare strings.', checklist: [{ label: 'Pack spare strings', isDone: false }, { label: 'Export click tracks', isDone: true }] },
      { id: 'event-friday-bill', title: 'Friday bill with Pine Harbor', type: M.BandEventType.show, startAt: new Date(2026, 3, 18, 0, 2), location: 'Example Hall', notes: 'Load-in at 17:30. Confirm merch table.', checklist: [{ label: 'Count merch stock', isDone: false }, { label: 'Confirm backline', isDone: false }, { label: 'Post final flyer', isDone: false }] },
      { id: 'event-vocal-tracking', title: 'Vocal tracking', type: M.BandEventType.recording, startAt: new Date(2026, 3, 22, 21, 2), location: 'Sample Sound Studio', notes: 'Print final lyric sheet and warm up before take one.', checklist: [{ label: 'Print lyric sheet', isDone: false }, { label: 'Prep harmony cues', isDone: false }] },
    ],
    tasks: [
      { id: 'task-post-flyer', title: 'Post final flyer assets', description: 'Schedule story and feed post for Friday bill.', assigneeDisplayName: 'Orion Pike', dueDate: new Date(2026, 3, 12), status: M.BandTaskStatus.inProgress, priority: M.BandTaskPriority.high, songId: null },
      { id: 'task-count-shirts', title: 'Count shirts and patches', description: 'Update merch inventory before the next show.', assigneeDisplayName: 'Juno Slate', dueDate: new Date(2026, 3, 14), status: M.BandTaskStatus.todo, priority: M.BandTaskPriority.medium, songId: null },
      { id: 'task-bounce-stems', title: 'Bounce backing stems', description: 'Export show-safe stereo stems and backup WAV.', assigneeDisplayName: 'Nova Vale', dueDate: new Date(2026, 3, 15), status: M.BandTaskStatus.todo, priority: M.BandTaskPriority.high, songId: null },
    ],
    contacts: [
      { id: 'contact-example-hall', name: 'Example Hall', type: M.BandContactType.venue, phone: '+40 720 100 001', email: 'booking@examplehall.test', notes: 'Load-in and stage plot contact for local shows.' },
      { id: 'contact-pine-harbor', name: 'Pine Harbor Promo', type: M.BandContactType.promoter, phone: '+40 720 100 002', email: 'team@pineharbor.test', notes: 'Friday bill promoter contact.' },
    ],
    releases: [],
    technicalRiders: [{
      id: 'rider-demo-main', riderName: 'Main club rider', bandName: 'Demo Band', contactPerson: 'Nova Vale',
      phone: '+40 720 100 010', email: 'nova@bandos.example', lineup: 'Vocals, guitar, bass, drums',
      shortNote: 'Bring one spare vocal mic and stage power on both sides.', updatedAt: new Date(2026, 3, 10),
      stageWidth: '6 m', stageDepth: '4 m',
      memberPositions: 'Vocals center, guitar stage left, bass stage right, drums center rear.',
      instrumentPositions: 'Bass cab stage right, guitar rig stage left.',
      ampPositions: '', monitorPositions: 'One front wedge left, one front wedge right, one drum wedge.',
      powerDropNotes: 'Two clean 230V drops at the front line.',
      inputList: [
        { id: 'rider-input-1', sourceName: 'Lead vocal', channelNumber: '1', micDiPreference: 'SM58', standType: 'Straight', phantomPower: false, stagePosition: 'Center', notes: '' },
        { id: 'rider-input-2', sourceName: 'Playback L/R', channelNumber: '9/10', micDiPreference: 'Stereo DI', standType: '', phantomPower: false, stagePosition: 'Stage left', notes: 'Shared laptop output with click split handled on band side.' },
      ],
      bandBackline: 'Snare, cymbals, laptop playback rig.',
      venueBackline: 'Full drum shell pack, bass head and 8x10, two guitar cabs.',
      usesIem: false, wedgesNeeded: true, monitorMixCount: '3',
      playbackClickNotes: 'Click stays off house, only in drummer feed.',
      powerRequirements: '230V across front line and drum riser.',
      outletLocationNotes: 'One outlet near drums, one stage left, one stage right.',
      additionalNotes: 'Please keep vocal FX return available on a separate stereo channel if possible.',
    }],
    expenses: [
      { id: 'expense-van-rental', title: 'Van rental deposit', amount: 180, date: new Date(2026, 3, 5), category: M.FinanceExpenseCategory.travel, paidBy: 'Orion Pike', notes: 'Deposit for Friday bill transport.', linkedEventId: 'event-friday-bill' },
      { id: 'expense-poster-print', title: 'Poster print run', amount: 65, date: new Date(2026, 3, 9), category: M.FinanceExpenseCategory.merchPrinting, paidBy: 'Nova Vale', notes: 'A3 run for local promo spots.' },
      { id: 'expense-fuel-last-month', title: 'Fuel top-up', amount: 42, date: new Date(2026, 2, 28), category: M.FinanceExpenseCategory.fuel, paidBy: 'Juno Slate', notes: '' },
    ],
    incomes: [
      { id: 'income-show-deposit', title: 'Friday bill deposit', amount: 900, date: new Date(2026, 3, 7), source: M.FinanceIncomeSource.showFee, receivedBy: 'Nova Vale', notes: 'First half of show fee.', linkedEventId: 'event-friday-bill' },
      { id: 'income-merch-cash', title: 'Merch cash drop', amount: 210, date: new Date(2026, 3, 11), source: M.FinanceIncomeSource.merchSale, receivedBy: 'Juno Slate', notes: 'After rehearsal-room pop-up.' },
      { id: 'income-royalties', title: 'Quarterly royalties', amount: 120, date: new Date(2026, 1, 14), source: M.FinanceIncomeSource.streamingOrRoyalties, receivedBy: 'Nova Vale', notes: '' },
    ],
    merchItems: [
      { id: 'merch-black-tee', itemName: 'Black tee', quantity: 24, unitPrice: 18, unitCost: 7.5, notes: 'Main black print run.', movements: [
        { id: 'movement-black-tee-add', type: M.MerchMovementType.stockAdded, quantity: 12, date: new Date(2026, 3, 2), notes: 'Restock from printer.' },
        { id: 'movement-black-tee-sold', type: M.MerchMovementType.stockSold, quantity: 8, date: new Date(2026, 3, 11), notes: 'Sold at rehearsal-room pop-up.' },
      ]},
      { id: 'merch-patch-pack', itemName: 'Patch pack', quantity: 40, unitPrice: 5, unitCost: 1.5, notes: 'Embroidered logo patch.', movements: [
        { id: 'movement-patch-sold', type: M.MerchMovementType.stockSold, quantity: 10, date: new Date(2026, 3, 9), notes: 'Bundle sale at local meetup.' },
      ]},
    ],
    setlists: [{
      id: 'setlist-demo-headline', title: 'Headline Club Set', updatedAt: new Date(2026, 3, 10),
      notes: 'Short reset after the opener. Keep the encore gap tight.',
      items: [
        { id: 'setlist-item-signal-fade', songId: 'song-signal-fade', songTitle: 'Signal Fade', songDuration: '3:48', order: 0, breakAfterSeconds: 30, breakAfterNotes: '' },
        { id: 'setlist-item-glass-lantern', songId: 'song-glass-lantern', songTitle: 'Glass Lantern', songDuration: '3:22', order: 1, breakAfterSeconds: 20, breakAfterNotes: '' },
        { id: 'setlist-item-northbound-echo', songId: 'song-northbound-echo', songTitle: 'Northbound Echo', songDuration: '4:12', order: 2, breakAfterSeconds: 0, breakAfterNotes: '' },
      ],
    }],
    setlistsCount: 1, contactsCount: 2, monthSpendEur: 305,
    releaseMilestoneLabel: 'Mix/master approval', updatedAt: new Date(2026, 3, 10),
    pendingInvites: [],
  };
}
