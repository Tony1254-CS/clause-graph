import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

type OpenOptions = {
  priceId: string;
  customerEmail?: string;
  userId: string;
  orgId: string;
  successUrl?: string;
};

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: OpenOptions) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId, orgId: options.orgId },
        settings: {
          displayMode: "overlay",
          successUrl:
            options.successUrl ||
            `${window.location.origin}/settings/billing?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
