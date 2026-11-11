export const isPhoneOrTablet = () => {
  const ua = navigator.userAgent || "";
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const smallTouch =
    window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1100;
  return mobileUA || iPadOS || smallTouch;
};