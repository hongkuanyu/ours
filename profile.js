(() => {
  const PROFILE_KEY = 'ours-profile-v1';
  const defaults = window.OURS_CONFIG || {};
  const genericNames = new Set(['亲爱的你', '阿宇', '小猪', 'HKY', 'HYJ', '我', '你']);
  const legacyStarts = new Set(['2025-05-20']);
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch {}
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) profile = {};

  const myName = profile.myName && !genericNames.has(profile.myName) ? profile.myName : (defaults.myName || '宝宝');
  const herName = profile.herName && !genericNames.has(profile.herName) ? profile.herName : (defaults.herName || '宝宝');
  const relationshipStart = profile.relationshipStart && !legacyStarts.has(profile.relationshipStart)
    ? profile.relationshipStart
    : (defaults.relationshipStart || '2026-10-20');
  const legacyBirthday = Number(profile.birthdayMonth) === 12 && Number(profile.birthdayDay) === 31;
  const birthdayMonth = profile.birthdayMonth && !legacyBirthday ? Number(profile.birthdayMonth) : Number(defaults.birthday?.month || 11);
  const birthdayDay = profile.birthdayDay && !legacyBirthday ? Number(profile.birthdayDay) : Number(defaults.birthday?.day || 25);
  const birthdayYear = profile.birthdayYear || Number(defaults.birthday?.year) || null;

  defaults.myName = myName;
  defaults.herName = herName;
  defaults.coupleLabel = `${myName} × ${herName}`;
  defaults.relationshipStart = relationshipStart;
  defaults.birthday.month = birthdayMonth;
  defaults.birthday.day = birthdayDay;
  defaults.birthday.year = birthdayYear;

  const normalizedProfile = {
    ...profile,
    myName,
    herName,
    relationshipStart,
    birthdayMonth,
    birthdayDay,
    birthdayYear,
  };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizedProfile)); } catch {}

  if (normalizedProfile.nextMeeting) localStorage.setItem('ours-next-meeting-v1', JSON.stringify(normalizedProfile.nextMeeting));

  const seedMarker = 'ours-personal-seed-v1';
  if (!localStorage.getItem(seedMarker)) {
    try {
      const eventsKey = 'ours-events-v1';
      const existing = JSON.parse(localStorage.getItem(eventsKey) || '[]');
      const current = Array.isArray(existing) ? existing : [];
      const now = new Date().toISOString();
      const anniversaries = [
        { id: 'anniversary-first-hold', title: '第一次牵手', date: '2026-11-01', allDay: true, startTime: '', endTime: '', location: '', status: 'confirmed', budget: '', actualCost: '', notes: '我们的第一次牵手。', prepItems: [], reminderDays: [0, 7], reminderEnabled: true, createdAt: now, updatedAt: now },
        { id: 'anniversary-first-kiss', title: '第一次亲脸', date: '2026-11-01', allDay: true, startTime: '', endTime: '', location: '', status: 'confirmed', budget: '', actualCost: '', notes: '第一次亲脸的纪念日。', prepItems: [], reminderDays: [0, 7], reminderEnabled: true, createdAt: now, updatedAt: now },
      ];
      const merged = [...current, ...anniversaries.filter((seed) => !current.some((item) => item?.id === seed.id))];
      localStorage.setItem(eventsKey, JSON.stringify(merged));
      localStorage.setItem(seedMarker, '2026-11-01');
    } catch {}
  }

  if (normalizedProfile.favoriteColor && /^#[0-9a-f]{6}$/i.test(normalizedProfile.favoriteColor)) {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--wine', normalizedProfile.favoriteColor);
      document.documentElement.style.setProperty('--wine-bright', normalizedProfile.favoriteColor);
    }, { once: true });
  }
})();