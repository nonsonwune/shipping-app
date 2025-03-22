import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, MessageCircle, Phone, Mail, FileText, HelpCircle } from "lucide-react"

export default function HelpPage() {
  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Help & Support</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input placeholder="Search for help" className="pl-9" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/faq">
          <div className="bg-white rounded-xl p-4 border border-gray-200 h-full flex flex-col items-center justify-center text-center">
            <HelpCircle className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-medium">FAQ</h3>
            <p className="text-xs text-gray-500">Frequently asked questions</p>
          </div>
        </Link>

        <Link href="/help/shipping-guide">
          <div className="bg-white rounded-xl p-4 border border-gray-200 h-full flex flex-col items-center justify-center text-center">
            <FileText className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-medium">Shipping Guide</h3>
            <p className="text-xs text-gray-500">How to ship with us</p>
          </div>
        </Link>
      </div>

      <h2 className="text-xl font-bold mb-4">Contact Us</h2>

      <div className="space-y-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Live Chat</h3>
              <p className="text-sm text-gray-500">Chat with our support team</p>
            </div>
            <Button size="sm">Chat Now</Button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Call Us</h3>
              <p className="text-sm text-gray-500">+234 (0) 123 456 7890</p>
            </div>
            <Button size="sm" variant="outline">
              Call
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">Email Us</h3>
              <p className="text-sm text-gray-500">support@shippingapp.com</p>
            </div>
            <Button size="sm" variant="outline">
              Email
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
        <h3 className="font-bold mb-2">Business Hours</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Monday - Friday:</span>
            <span>8:00 AM - 6:00 PM</span>
          </div>
          <div className="flex justify-between">
            <span>Saturday:</span>
            <span>9:00 AM - 3:00 PM</span>
          </div>
          <div className="flex justify-between">
            <span>Sunday:</span>
            <span>Closed</span>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Submit a Request</h2>

      <div className="space-y-4">
        <div>
          <Input placeholder="Your name" />
        </div>
        <div>
          <Input placeholder="Email address" />
        </div>
        <div>
          <Input placeholder="Subject" />
        </div>
        <div>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Describe your issue or question"
          ></textarea>
        </div>
        <Button className="w-full bg-primary">Submit Request</Button>
      </div>
    </div>
  )
}

