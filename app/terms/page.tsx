import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TermsOfServicePage() {
  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Terms of Service</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm text-gray-600">Last Updated: March 15, 2024</p>
      </div>

      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-bold mb-3">1. Introduction</h2>
          <p className="text-gray-700 mb-3">
            Welcome to the Shipping & Logistics App. These Terms of Service ("Terms") govern your use of our mobile
            application, website, and services (collectively, the "Service"). By accessing or using the Service, you
            agree to be bound by these Terms.
          </p>
          <p className="text-gray-700">
            Please read these Terms carefully before using our Service. If you do not agree with any part of these
            Terms, you may not use our Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">2. Definitions</h2>
          <p className="text-gray-700 mb-3">
            <strong>"User"</strong> refers to any individual who accesses or uses our Service.
          </p>
          <p className="text-gray-700 mb-3">
            <strong>"Shipment"</strong> refers to any package, parcel, or goods that are transported through our
            Service.
          </p>
          <p className="text-gray-700 mb-3">
            <strong>"Carrier"</strong> refers to any third-party transportation provider that we use to fulfill shipping
            services.
          </p>
          <p className="text-gray-700">
            <strong>"Content"</strong> refers to any information, data, text, graphics, or other materials displayed on
            or through the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">3. Account Registration</h2>
          <p className="text-gray-700 mb-3">
            To use certain features of the Service, you may be required to register for an account. You agree to provide
            accurate, current, and complete information during the registration process and to update such information
            to keep it accurate, current, and complete.
          </p>
          <p className="text-gray-700 mb-3">
            You are responsible for safeguarding your password and for all activities that occur under your account. You
            agree to notify us immediately of any unauthorized use of your account.
          </p>
          <p className="text-gray-700">
            We reserve the right to disable any user account at any time if, in our opinion, you have failed to comply
            with any provision of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">4. Shipping Services</h2>
          <p className="text-gray-700 mb-3">
            Our Service facilitates the shipping of goods between various locations. By using our shipping services, you
            agree to comply with all applicable laws and regulations regarding the shipment of goods.
          </p>
          <p className="text-gray-700 mb-3">
            You are responsible for providing accurate information about your shipment, including but not limited to
            weight, dimensions, contents, origin, and destination. Inaccurate information may result in additional
            charges or delays.
          </p>
          <p className="text-gray-700">
            We reserve the right to inspect any shipment to ensure compliance with applicable laws and our policies. We
            may refuse to handle any shipment that contains prohibited items or that does not comply with our packaging
            requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">5. Prohibited Items</h2>
          <p className="text-gray-700 mb-3">
            The following items are prohibited from being shipped through our Service:
          </p>
          <ul className="list-disc pl-5 text-gray-700 mb-3 space-y-1">
            <li>Illegal drugs and narcotics</li>
            <li>Weapons, firearms, and ammunition</li>
            <li>Hazardous materials and dangerous goods</li>
            <li>Counterfeit goods and unauthorized replicas</li>
            <li>Human remains or body parts</li>
            <li>Live animals or protected species</li>
            <li>Perishable items without proper packaging</li>
            <li>Cash, currency, and negotiable instruments</li>
          </ul>
          <p className="text-gray-700">
            This list is not exhaustive, and we reserve the right to refuse any shipment at our discretion.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">6. Fees and Payment</h2>
          <p className="text-gray-700 mb-3">
            The fees for our Service are set forth on our website and in our mobile application. We reserve the right to
            change our fees at any time.
          </p>
          <p className="text-gray-700 mb-3">
            You agree to pay all fees and charges incurred in connection with your use of the Service. All payments are
            non-refundable except as expressly provided in these Terms.
          </p>
          <p className="text-gray-700">
            Additional charges may apply for customs duties, taxes, and other governmental fees. You are responsible for
            paying these charges.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">7. Liability and Insurance</h2>
          <p className="text-gray-700 mb-3">
            Our liability for loss, damage, or delay of shipments is limited as set forth in our Shipping Policy. We
            recommend that you purchase insurance for valuable shipments.
          </p>
          <p className="text-gray-700">
            We are not liable for any indirect, incidental, special, consequential, or punitive damages, including lost
            profits, arising out of or in connection with your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">8. Privacy</h2>
          <p className="text-gray-700">
            Our Privacy Policy governs the collection, use, and disclosure of your personal information. By using our
            Service, you consent to the collection and use of your information as described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">9. Termination</h2>
          <p className="text-gray-700">
            We may terminate or suspend your access to the Service immediately, without prior notice or liability, for
            any reason whatsoever, including without limitation if you breach these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">10. Changes to Terms</h2>
          <p className="text-gray-700">
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide
            notice of any changes by posting the new Terms on our website and in our mobile application. Your continued
            use of the Service after any such changes constitutes your acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-3">11. Contact Us</h2>
          <p className="text-gray-700">
            If you have any questions about these Terms, please contact us at legal@shippingapp.com or through the
            contact information provided in our mobile application.
          </p>
        </section>
      </div>
    </div>
  )
}

