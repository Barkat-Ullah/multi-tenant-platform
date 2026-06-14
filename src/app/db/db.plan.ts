// import { DurationType, PlanTier, PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// const FEATURES = [
//   'Add unlimited locations',
//   'Upload up to 10 images per location',
//   'Add 1 promotion/per location',
// ];

// async function seedSubscriptions() {
//   const plans = [
//     // ─── GOLD ───────────────────────────────────────
//     {
//       title: 'Gold - 1 Month',
//       tier: PlanTier.Gold,
//       amount: 98,
//       duration: DurationType.Monthly,
//       features: FEATURES,
//       isLifeTime: false,
//     },
//     {
//       title: 'Gold - 3 Months',
//       tier: PlanTier.Gold,
//       amount: 249,
//       duration: DurationType.ThreeMonth,
//       features: FEATURES,
//       isLifeTime: false,
//     },
//     {
//       title: 'Gold - 1 Year',
//       tier: PlanTier.Gold,
//       amount: 777,
//       duration: DurationType.Yearly,
//       features: FEATURES,
//       isLifeTime: false,
//     },

//     // ─── PLATINUM ────────────────────────────────────
//     {
//       title: 'Platinum - 1 Month',
//       tier: PlanTier.Platinum,
//       amount: 233,
//       duration: DurationType.Monthly,
//       features: FEATURES,
//       isLifeTime: false,
//     },
//     {
//       title: 'Platinum - 3 Months',
//       tier: PlanTier.Platinum,
//       amount: 594,
//       duration: DurationType.ThreeMonth,
//       features: FEATURES,
//       isLifeTime: false,
//     },
//     {
//       title: 'Platinum - 1 Year',
//       tier: PlanTier.Platinum,
//       amount: 1888,
//       duration: DurationType.Yearly,
//       features: FEATURES,
//       isLifeTime: false,
//     },

//     // ─── DIAMOND ─────────────────────────────────────
//     {
//       title: 'Diamond - Unlimited',
//       tier: PlanTier.Diamond,
//       amount: 4999,
//       duration: DurationType.Unlimited,
//       features: FEATURES,
//       isLifeTime: true,
//     },
//   ];

//   for (const plan of plans) {
//     const existing = await prisma.subscription.findFirst({
//       where: {
//         tier: plan.tier,
//         duration: plan.duration,
//       },
//     });

//     if (existing) {
//       console.log(`⚠️  Already exists: ${plan.title}`);
//       continue;
//     }

//     await prisma.subscription.create({ data: plan });
//     console.log(`✅ Seeded: ${plan.title}`);
//   }

//   console.log('🎉 Subscription seeding complete!');
// }

// export default seedSubscriptions;
