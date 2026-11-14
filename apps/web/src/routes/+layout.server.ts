export function load() {
  return {
    live: process.env.LEMMI_MODE === 'live',
    demoEnrollment: process.env.LEMMI_DEMO_ENROLLMENT === '1',
  };
}
