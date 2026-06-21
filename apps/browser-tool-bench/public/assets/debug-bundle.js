(function () {
  const state = { cartId: "CART-9A2", selectedCoupon: null };

  function applySelectedCoupon(cartState) {
    return cartState.selectedCoupon.couponCode.toUpperCase();
  }

  function renderCheckoutFailure(error) {
    const errorEl = document.getElementById("coupon-error");
    errorEl.textContent = "应用失败，请联系管理员（错误码已上报）";
    errorEl.hidden = false;
    console.error("checkout coupon crash", {
      cartId: state.cartId,
      originalSource: "src/cart/coupon.ts:12",
      functionName: "applySelectedCoupon",
      error,
    });
  }

  document.getElementById("apply-coupon").addEventListener("click", () => {
    try {
      applySelectedCoupon(state);
    } catch (error) {
      renderCheckoutFailure(error);
    }
  });
})();
//# sourceMappingURL=/assets/debug-bundle.js.map
