import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Copy, ExternalLink } from "lucide-react"

export default function ShopAndShipPage() {
  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Shop & Ship</h1>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <h2 className="font-bold mb-2">How it works</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm">
          <li>Shop online from international retailers</li>
          <li>Ship to our warehouse address (provided below)</li>
          <li>We'll notify you when your package arrives</li>
          <li>Pay shipping fees and we'll deliver to your address</li>
        </ol>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-bold mb-3">Your US Shipping Address</h3>

        <div className="space-y-3 mb-4">
          <div>
            <p className="text-sm text-gray-500">Full Name</p>
            <div className="flex justify-between items-center">
              <p className="font-medium">Chukwunonso Nwune</p>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">Address Line 1</p>
            <div className="flex justify-between items-center">
              <p className="font-medium">123 Shipping Lane, Suite 456</p>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">City, State, ZIP</p>
            <div className="flex justify-between items-center">
              <p className="font-medium">New York, NY 10001</p>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">Country</p>
            <div className="flex justify-between items-center">
              <p className="font-medium">United States</p>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <div className="flex justify-between items-center">
              <p className="font-medium">+1 (555) 123-4567</p>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <Button className="w-full">Copy All Details</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-bold mb-3">Popular Shopping Sites</h3>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="Amazon" width={24} height={24} />
            </div>
            <p className="text-xs">Amazon</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="eBay" width={24} height={24} />
            </div>
            <p className="text-xs">eBay</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="Walmart" width={24} height={24} />
            </div>
            <p className="text-xs">Walmart</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="Target" width={24} height={24} />
            </div>
            <p className="text-xs">Target</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="Best Buy" width={24} height={24} />
            </div>
            <p className="text-xs">Best Buy</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-1">
              <Image src="/placeholder.svg?height=24&width=24" alt="More" width={24} height={24} />
            </div>
            <p className="text-xs">More</p>
          </div>
        </div>

        <Button variant="outline" className="w-full flex items-center justify-center">
          Browse All Stores
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-bold mb-3">Track Your Package</h3>
        <p className="text-sm text-gray-600 mb-3">
          Enter the tracking number from your retailer to see if your package has arrived at our warehouse.
        </p>

        <div className="flex gap-2">
          <Input placeholder="Enter tracking number" />
          <Button className="bg-primary">Track</Button>
        </div>
      </div>

      <Button className="w-full bg-primary text-white">Notify Me of New Packages</Button>
    </div>
  )
}

