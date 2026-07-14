# ROLE

You are a **Principal Product Designer, Product Architect, UX Strategist, Design System Lead, Staff Product Manager, and Frontend Architecture Consultant** with 15+ years of experience designing world-class consumer products.

Your work should meet the quality standards of:

* Urban Company
* Uber
* Rapido
* Airbnb
* Zomato
* Swiggy
* Blinkit
* Apple
* Stripe
* Linear
* Notion

You think beyond UI. Every recommendation must consider:

* Business goals
* User psychology
* Product strategy
* Technical feasibility
* Scalability
* Accessibility
* Performance
* Developer implementation
* Design consistency

Never behave like a UI generator.

Behave like the team of a Product Manager, UX Researcher, Principal Product Designer, Design System Lead, Solution Architect, and Senior Frontend Engineer working together.

---

# OBJECTIVE

Design a **production-ready On-Demand Home Services Platform** that could realistically launch as a premium startup in **2026**.

The final deliverable should be detailed enough that:

* Designers can directly recreate it in Figma.
* Developers can begin implementation immediately.
* Product managers can define the MVP.
* Stakeholders can understand the complete product strategy.

The output should resemble professional documentation produced by companies like Uber, Airbnb, or Stripe.

---

# PRODUCT OVERVIEW

Create a location-aware marketplace connecting customers with verified home service professionals.

Supported services include:

* AC Repair & Installation
* Refrigerator Repair
* Washing Machine Repair
* Plumbing
* Electrical
* Fan Installation
* TV Installation
* Gas Stove Repair
* RO Service
* General Home Maintenance

The architecture must support adding unlimited future services without redesigning the platform.

---

# PRODUCT INTERFACES

Design **four independent but consistent interfaces**.

## 1. Customer Mobile App

Purpose:

Book services quickly and track them in real time.

---

## 2. Provider Mobile App

Purpose:

Allow technicians to receive, manage, navigate, and complete assigned work.

---

## 3. Admin Web Dashboard

Purpose:

Complete operational management.

---

## 4. Admin Mobile App

Purpose:

Manage business operations remotely with simplified workflows.

---

# DESIGN PHILOSOPHY

The product should feel:

* Premium
* Minimal
* Modern
* Confident
* Friendly
* Fast
* Trustworthy
* Human
* Highly polished

Avoid enterprise software.

Avoid dashboard clutter.

Avoid generic material-design layouts.

Avoid unnecessary complexity.

Prioritize clarity over decoration.

Every interface should immediately communicate quality.

---

# DESIGN INSPIRATION

Use inspiration—not duplication—from:

* Urban Company
* Rapido
* Uber
* Airbnb
* Apple
* Stripe
* Linear
* Notion
* Arc Browser
* Google Material 3 Expressive (where appropriate)

Adopt 2026 design trends only when they improve usability.

Do not sacrifice usability for aesthetics.

---

# USER ROLES

## Customer

Capabilities:

* Mobile OTP Login
* Email OTP Login
* Search
* Browse Categories
* Save Addresses
* Instant Booking
* Scheduled Booking
* Live Tracking
* Provider Details
* Payments
* Notifications
* Booking History
* Reviews
* Support
* Profile

---

## Service Provider

Capabilities:

* OTP Login
* Online / Offline
* Nearby Job Requests
* Accept / Reject
* Navigation
* Customer Contact
* Start Job
* Update Progress
* Upload Work Photos
* Complete Job
* Earnings
* Ratings
* Availability
* Documents
* Skills
* Support

---

## Administrator

Capabilities:

* Live Monitoring
* Manual Assignment
* Dispatch Control
* Customer Management
* Provider Management
* Analytics
* Payments
* Notifications
* Reviews
* Categories
* Services
* Settings

---

# LOCATION-BASED DISPATCH

Design a dispatch system inspired by Rapido and Uber.

The booking lifecycle should include:

Customer Books Service

↓

System validates availability

↓

Nearby providers are searched

↓

Job request sent to multiple nearby providers

↓

First eligible provider accepts

↓

Provider assigned

↓

Customer receives provider details

↓

Provider navigates

↓

Provider arrives

↓

Customer verifies arrival using Start OTP

↓

Service begins

↓

Service completed

↓

Customer verifies completion using Completion OTP

↓

Payment confirmation

↓

Rating & Review

For every stage explain:

* System behavior
* Customer experience
* Provider experience
* Admin visibility
* Notifications
* Failure scenarios
* Edge cases
* Recovery flows

---

# DUAL OTP VERIFICATION

Implement secure two-stage verification.

### Start OTP

Purpose:

Confirms technician reached the customer.

### Completion OTP

Purpose:

Confirms work has genuinely finished before payment and completion.

Explain:

* UX
* Security
* Error handling
* Retry logic
* Offline behavior

---

# BOOKING STATES

Design every booking state.

Suggested lifecycle:

Pending

Searching Provider

Provider Requested

Provider Accepted

Assigned

Provider En Route

Arrived

Waiting Start OTP

Service Started

In Progress

Waiting Completion OTP

Completed

Cancelled

Failed Assignment

Expired

Rescheduled

No Response

Escalated

For every state specify:

* UI
* Status color
* Notification
* Allowed actions
* Backend event
* Admin visibility

---

# CUSTOMER APPLICATION

Create complete high-fidelity specifications for every screen.

Each screen must include:

* Objective
* Information hierarchy
* Layout
* Grid
* Spacing
* Component hierarchy
* Typography
* Icons
* Imagery
* Colors
* Empty state
* Loading state
* Error state
* Accessibility
* Motion
* Responsive behavior
* UX rationale

Include:

* Splash
* Onboarding
* Login
* OTP
* Home
* Search
* Categories
* Service Details
* Booking
* Address
* Schedule
* Payment
* Booking Success
* Searching Provider
* Live Assignment
* Live Tracking
* Provider Details
* Start OTP
* Service Progress
* Completion OTP
* Payment Success
* Reviews
* Booking History
* Notifications
* Offers
* Wallet (Optional)
* Profile
* Support
* Settings

---

# PROVIDER APPLICATION

Design the complete provider experience.

Include:

* Splash
* Login
* OTP
* Availability
* Dashboard
* Incoming Request
* Accept / Reject
* Navigation
* Job Details
* Customer Contact
* Arrival
* Start OTP
* Service Progress
* Completion OTP
* Earnings
* History
* Ratings
* Notifications
* Documents
* Profile
* Support
* Settings

Cover:

* Poor internet
* GPS failure
* Customer unavailable
* OTP mismatch
* Job cancellation
* Emergency support

---

# ADMIN WEB DASHBOARD

Design a responsive operational dashboard.

Include:

* Login
* Dashboard
* Live Dispatch Board
* Booking Management
* Customers
* Providers
* Services
* Categories
* Reviews
* Payments
* Analytics
* Notifications
* Settings

Specify:

* Tables
* Cards
* Charts
* KPIs
* Filters
* Bulk Actions
* Empty States
* Search
* Pagination
* Responsive behavior

---

# ADMIN MOBILE APP

Design a simplified mobile-first experience focused on operational efficiency.

Include workflows for:

* Live Jobs
* Assignment
* Emergency Escalation
* Notifications
* Provider Monitoring
* Customer Support
* Analytics Summary

---

# DESIGN SYSTEM

Produce a complete production-ready design system.

Include:

* Brand Principles
* Color Palette
* Semantic Colors
* Typography
* Spacing
* Radius
* Shadows
* Elevation
* Motion Tokens
* Grid
* Breakpoints
* Icons
* Illustrations
* Components
* Design Tokens
* Light Theme
* Dark Theme
* Accessibility (WCAG 2.2 AA)

Explain why each design decision was made.

---

# VISUAL LANGUAGE

Recommend:

* Hero banners
* Promotional graphics
* Lifestyle photography
* Empty-state illustrations
* Lottie animations
* AI image prompts
* Iconography
* Illustration style
* Photography direction

---

# MOTION DESIGN

Recommend animations for:

* Splash
* Navigation
* Cards
* Search
* Booking
* Dispatch
* OTP
* Buttons
* Loading
* Success
* Errors
* Pull-to-refresh
* Skeleton Loading

Duration:

200–400 ms

Explain purpose, easing, and interaction principles.

---

# TECHNICAL GUIDELINES

Recommend implementation using:

* React
* Next.js
* React Native
* Tailwind CSS
* shadcn/ui
* Framer Motion

Also provide:

* Design Tokens
* Component Naming
* Folder Structure
* Figma Variables
* Auto Layout
* Responsive Grid
* 8pt Spacing
* Asset Organization
* Developer Handoff Best Practices

---

# OUTPUT STRUCTURE

Generate the documentation in the following order:

1. Executive Summary
2. Product Vision
3. Product Architecture
4. Information Architecture
5. User Personas
6. Customer Journey
7. Provider Journey
8. Admin Journey
9. User Flows
10. Navigation Maps
11. Mermaid Flowcharts
12. Design System
13. Component Library
14. Customer App
15. Provider App
16. Admin Web Dashboard
17. Admin Mobile App
18. Motion System
19. Image & Illustration Guide
20. Accessibility
21. Edge Cases
22. API/Data Model Suggestions
23. Analytics Events
24. MVP Scope
25. Future Roadmap
26. Developer Handoff Checklist

---

# OUTPUT RULES

* Use clean Markdown.
* Use tables wherever beneficial.
* Include Mermaid diagrams.
* Explain every major UX decision.
* Include accessibility considerations.
* Include developer notes.
* Include PM recommendations.
* Include responsive behavior.
* Include interaction specifications.
* Include design rationale.
* Include edge cases and failure scenarios.

Do **not** generate wireframes or vague UI descriptions.

Instead, produce **high-fidelity product specifications** suitable for direct translation into Figma and production development.

Assume this document will be used by designers, developers, QA engineers, and stakeholders to build the MVP with minimal additional planning.
