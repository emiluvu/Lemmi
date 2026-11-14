export function load() {
  return {
    live: process.env.LEMMI_MODE === 'live',
    photoStoryRehearsal:
      process.env.LEMMI_MODE !== 'live' && process.env.LEMMI_PHOTO_STORY_DEMO === '1',
    demoEnrollment: process.env.LEMMI_DEMO_ENROLLMENT === '1',
  };
}
