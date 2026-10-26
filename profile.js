(() => {
  const PROFILE_KEY = 'ours-profile-v1';
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch {}
  if (!profile || typeof profile !== 'object') return;
  if (profile.relationshipStart) window.OURS_CONFIG.relationshipStart = profile.relationshipStart;
  if (profile.herName) window.OURS_CONFIG.herName = profile.herName;
  if (profile.birthdayMonth && profile.birthdayDay) {
    window.OURS_CONFIG.birthday.month = Number(profile.birthdayMonth);
    window.OURS_CONFIG.birthday.day = Number(profile.birthdayDay);
  }
  if (profile.nextMeeting) localStorage.setItem('ours-next-meeting-v1', JSON.stringify(profile.nextMeeting));
  if (profile.favoriteColor && /^#[0-9a-f]{6}$/i.test(profile.favoriteColor)) {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.setProperty('--wine', profile.favoriteColor);
      document.documentElement.style.setProperty('--wine-bright', profile.favoriteColor);
    }, { once: true });
  }
})();