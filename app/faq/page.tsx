import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"

export default function FAQPage() {
  const faqCategories = [
    {
      title: "Shipping & Delivery",
      items: [
        {
          question: "How long does shipping take?",
          answer:
            "Shipping times vary by service type. Import by Sea takes 8-12 weeks, Import by Air takes 1-2 weeks, and China Imports typically take 3-5 weeks. Exact delivery times will be provided when you book a shipment.",
        },
        {
          question: "How can I track my shipment?",
          answer:
            "You can track your shipment by entering your tracking number on the Track Shipment page. You'll receive real-time updates on your shipment's status and location.",
        },
        {
          question: "What happens if my package is delayed?",
          answer:
            "If your package is delayed, you'll receive a notification with the reason for the delay and the updated estimated delivery date. Our customer support team will work to resolve any issues as quickly as possible.",
        },
      ],
    },
    {
      title: "Payments & Billing",
      items: [
        {
          question: "What payment methods do you accept?",
          answer:
            "We accept bank transfers, credit/debit cards, and payments through our wallet system. You can fund your wallet and use it for multiple shipments.",
        },
        {
          question: "How do I get a refund?",
          answer:
            "If you need a refund for a service that wasn't provided, please contact our customer support team. Refunds are typically processed within 7-14 business days, depending on your payment method.",
        },
        {
          question: "Are there any hidden fees?",
          answer:
            "No, we provide transparent pricing. All applicable fees will be shown before you confirm your shipment. These may include shipping costs, insurance, customs duties, and taxes.",
        },
      ],
    },
    {
      title: "Account & Services",
      items: [
        {
          question: "How do I create an account?",
          answer:
            "You can create an account by downloading our app or visiting our website. Click on 'Sign Up' and follow the instructions to complete your registration.",
        },
        {
          question: "What is Shop & Ship?",
          answer:
            "Shop & Ship allows you to shop from international retailers and have your purchases delivered to our warehouse. We'll then consolidate your packages and ship them to your address in Nigeria.",
        },
        {
          question: "How do I change my account information?",
          answer:
            "You can update your account information by going to the Account page and clicking on 'Edit Profile'. From there, you can change your name, email, phone number, and other details.",
        },
      ],
    },
    {
      title: "Customs & Regulations",
      items: [
        {
          question: "Do I need to pay customs duties?",
          answer:
            "Yes, customs duties may apply to your shipments. These are determined by Nigerian customs authorities based on the type and value of goods. We'll provide an estimate during the booking process.",
        },
        {
          question: "What items are prohibited?",
          answer:
            "Prohibited items include illegal drugs, weapons, counterfeit goods, and certain food items. Please check our terms of service for a complete list of prohibited and restricted items.",
        },
        {
          question: "Do you handle customs clearance?",
          answer:
            "Yes, we provide customs clearance services for all shipments. Our team will handle the necessary documentation and procedures to ensure your shipment clears customs efficiently.",
        },
      ],
    },
  ]

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center mb-6">
        <Link href="/account" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">FAQ</h1>
      </div>

      <div className="mb-6">
        <p className="text-gray-600">
          Find answers to frequently asked questions about our services, shipping processes, and more.
        </p>
      </div>

      {faqCategories.map((category, index) => (
        <div key={index} className="mb-6">
          <h2 className="text-xl font-bold mb-3">{category.title}</h2>

          <Accordion type="single" collapsible className="w-full">
            {category.items.map((item, itemIndex) => (
              <AccordionItem key={itemIndex} value={`item-${index}-${itemIndex}`}>
                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-gray-600">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ))}

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
        <h3 className="font-bold mb-2">Still have questions?</h3>
        <p className="text-sm text-gray-600 mb-3">
          Our support team is available to help you with any questions or concerns you may have.
        </p>
        <Button className="w-full bg-primary text-white">Contact Support</Button>
      </div>
    </div>
  )
}

