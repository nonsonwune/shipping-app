"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, CreditCard, Plus, Trash2, Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: 1,
      type: "card",
      name: "Visa ending in 4242",
      details: "Expires 12/25",
      isDefault: true,
    },
    {
      id: 2,
      type: "card",
      name: "Mastercard ending in 5555",
      details: "Expires 08/26",
      isDefault: false,
    },
  ])

  const [isAddingCard, setIsAddingCard] = useState(false)

  const handleDeletePaymentMethod = (id: number) => {
    setPaymentMethods(paymentMethods.filter((method) => method.id !== id))
  }

  const handleSetDefault = (id: number) => {
    setPaymentMethods(
      paymentMethods.map((method) => ({
        ...method,
        isDefault: method.id === id,
      })),
    )
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Payment Methods</h1>
      </div>

      <div className="mb-6">
        <Button className="w-full flex items-center gap-2" onClick={() => setIsAddingCard(true)}>
          <Plus className="w-4 h-4" />
          Add Payment Method
        </Button>
      </div>

      <div className="space-y-4">
        {paymentMethods.map((method) => (
          <div key={method.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start">
              <div className="bg-blue-100 p-2 rounded-full mr-3">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <h3 className="font-bold">{method.name}</h3>
                  {method.isDefault && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </div>

                <p className="text-sm text-gray-600">{method.details}</p>

                <div className="flex mt-3 gap-3">
                  {!method.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleSetDefault(method.id)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Set as Default
                    </Button>
                  )}

                  {!method.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => handleDeletePaymentMethod(method.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>Add a new credit or debit card to your account.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="card-number">Card Number</Label>
              <Input id="card-number" placeholder="1234 5678 9012 3456" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input id="expiry" placeholder="MM/YY" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input id="cvv" placeholder="123" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Cardholder Name</Label>
              <Input id="name" placeholder="Enter name as it appears on card" />
            </div>

            <div className="flex items-center space-x-2">
              <input type="checkbox" id="default-payment" className="rounded border-gray-300" />
              <Label htmlFor="default-payment">Set as default payment method</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCard(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsAddingCard(false)}>Add Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="font-bold mb-2">Secure Payments</h3>
        <p className="text-sm text-gray-600">
          All payment information is encrypted and securely stored. We never store your full card details on our
          servers.
        </p>
      </div>
    </div>
  )
}

