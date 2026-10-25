from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class CheckoutSessionCreate(BaseModel):
    tier: str = Field(..., pattern="^(pro|studio)$")
    provider: str = Field("stripe", pattern="^(stripe|razorpay)$")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str
    provider: str
    tier: str
    amount_cents: int
    currency: str

class RazorpayOrderCreate(BaseModel):
    tier: str = Field(..., pattern="^(pro|studio)$")
    currency: str = "INR"

class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount_paise: int
    currency: str
    key_id: str
    tier: str

class RazorpayPaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    tier: str = "pro"

class SubscriptionCancelRequest(BaseModel):
    subscription_id: Optional[str] = None
    immediate: bool = False
    reason: Optional[str] = None

class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    tier: str
    status: str
    provider: str
    monthly_credit_allowance: int
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    plan_id: Optional[str] = None

    class Config:
        from_attributes = True

class ReceiptResponse(BaseModel):
    id: str
    user_id: str
    amount_cents: int
    currency: str
    status: str
    provider: str
    payment_method: str
    receipt_url: Optional[str] = None
    payment_intent_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CreditBalanceResponse(BaseModel):
    credits_balance: int
    reserved_credits: int
    tier: str
    role: str
