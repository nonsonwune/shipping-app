"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft } from "lucide-react"

export default function NotificationSettingsPage() {
  // Push notification settings
  const [pushSettings, setPushSettings] = useState({
    shipmentUpdates: true,
    deliveryAlerts: true,
    paymentConfirmations: true,
    promotions: false,
    systemUpdates: true,
  })

  // Email notification settings
  const [emailSettings, setEmailSettings] = useState({
    shipmentUpdates: true,
    deliveryAlerts: true,
    paymentConfirmations: true,
    promotions: true,
    systemUpdates: true,
    newsletter: false,
  })

  // SMS notification settings
  const [smsSettings, setSmsSettings] = useState({
    shipmentUpdates: false,
    deliveryAlerts: true,
    paymentConfirmations: false,
    promotions: false,
  })

  const updatePushSetting = (key: string, value: boolean) => {
    setPushSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateEmailSetting = (key: string, value: boolean) => {
    setEmailSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateSmsSetting = (key: string, value: boolean) => {
    setSmsSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account/settings" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Notification Settings</h1>
      </div>

      <p className="text-gray-600 mb-6">Customize which notifications you receive and how you receive them.</p>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Push Notifications</h2>
            <p className="text-sm text-gray-500">Notifications that appear on your device</p>
          </div>

          <div className="divide-y">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Shipment Updates</p>
                <p className="text-sm text-gray-500">Status changes for your shipments</p>
              </div>
              <Switch
                checked={pushSettings.shipmentUpdates}
                onCheckedChange={(value) => updatePushSetting("shipmentUpdates", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Delivery Alerts</p>
                <p className="text-sm text-gray-500">Notifications about delivery status</p>
              </div>
              <Switch
                checked={pushSettings.deliveryAlerts}
                onCheckedChange={(value) => updatePushSetting("deliveryAlerts", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Payment Confirmations</p>
                <p className="text-sm text-gray-500">Alerts about payments and transactions</p>
              </div>
              <Switch
                checked={pushSettings.paymentConfirmations}
                onCheckedChange={(value) => updatePushSetting("paymentConfirmations", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Promotions & Offers</p>
                <p className="text-sm text-gray-500">Special deals and promotional offers</p>
              </div>
              <Switch
                checked={pushSettings.promotions}
                onCheckedChange={(value) => updatePushSetting("promotions", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">System Updates</p>
                <p className="text-sm text-gray-500">Important app and service updates</p>
              </div>
              <Switch
                checked={pushSettings.systemUpdates}
                onCheckedChange={(value) => updatePushSetting("systemUpdates", value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Email Notifications</h2>
            <p className="text-sm text-gray-500">Notifications sent to your email address</p>
          </div>

          <div className="divide-y">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Shipment Updates</p>
                <p className="text-sm text-gray-500">Status changes for your shipments</p>
              </div>
              <Switch
                checked={emailSettings.shipmentUpdates}
                onCheckedChange={(value) => updateEmailSetting("shipmentUpdates", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Delivery Alerts</p>
                <p className="text-sm text-gray-500">Notifications about delivery status</p>
              </div>
              <Switch
                checked={emailSettings.deliveryAlerts}
                onCheckedChange={(value) => updateEmailSetting("deliveryAlerts", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Payment Confirmations</p>
                <p className="text-sm text-gray-500">Alerts about payments and transactions</p>
              </div>
              <Switch
                checked={emailSettings.paymentConfirmations}
                onCheckedChange={(value) => updateEmailSetting("paymentConfirmations", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Promotions & Offers</p>
                <p className="text-sm text-gray-500">Special deals and promotional offers</p>
              </div>
              <Switch
                checked={emailSettings.promotions}
                onCheckedChange={(value) => updateEmailSetting("promotions", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">System Updates</p>
                <p className="text-sm text-gray-500">Important app and service updates</p>
              </div>
              <Switch
                checked={emailSettings.systemUpdates}
                onCheckedChange={(value) => updateEmailSetting("systemUpdates", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Newsletter</p>
                <p className="text-sm text-gray-500">Monthly shipping tips and industry news</p>
              </div>
              <Switch
                checked={emailSettings.newsletter}
                onCheckedChange={(value) => updateEmailSetting("newsletter", value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">SMS Notifications</h2>
            <p className="text-sm text-gray-500">Notifications sent to your phone number</p>
          </div>

          <div className="divide-y">
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Shipment Updates</p>
                <p className="text-sm text-gray-500">Status changes for your shipments</p>
              </div>
              <Switch
                checked={smsSettings.shipmentUpdates}
                onCheckedChange={(value) => updateSmsSetting("shipmentUpdates", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Delivery Alerts</p>
                <p className="text-sm text-gray-500">Notifications about delivery status</p>
              </div>
              <Switch
                checked={smsSettings.deliveryAlerts}
                onCheckedChange={(value) => updateSmsSetting("deliveryAlerts", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Payment Confirmations</p>
                <p className="text-sm text-gray-500">Alerts about payments and transactions</p>
              </div>
              <Switch
                checked={smsSettings.paymentConfirmations}
                onCheckedChange={(value) => updateSmsSetting("paymentConfirmations", value)}
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Promotions & Offers</p>
                <p className="text-sm text-gray-500">Special deals and promotional offers</p>
              </div>
              <Switch
                checked={smsSettings.promotions}
                onCheckedChange={(value) => updateSmsSetting("promotions", value)}
              />
            </div>
          </div>
        </div>

        <Button className="w-full bg-primary">Save Preferences</Button>
      </div>
    </div>
  )
}

