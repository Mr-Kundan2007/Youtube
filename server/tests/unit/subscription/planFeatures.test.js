import { TestRunner } from "../../helpers/testEnv.js"
import {
  PLAN_CONFIGURATIONS,
  PLAN_HIERARCHY,
  canAccessPlanContent,
  isQualityAllowed,
  calculatePlanPricing,
} from "../../../config/subscriptionConfig.js"

export async function runPlanFeaturesUnitTest() {
  const runner = new TestRunner("Unit: Plan Feature Matrices & Content Permissions")
  runner.start()

  // 1. Hierarchy Ranking
  runner.assert(PLAN_HIERARCHY.free === 1, "Free plan ranked at level 1")
  runner.assert(PLAN_HIERARCHY.bronze === 2, "Bronze plan ranked at level 2")
  runner.assert(PLAN_HIERARCHY.silver === 3, "Silver plan ranked at level 3")
  runner.assert(PLAN_HIERARCHY.gold === 4, "Gold plan ranked at highest level 4")

  // 2. Feature Configurations
  const freeConfig = PLAN_CONFIGURATIONS.free
  runner.assert(freeConfig.dailyDownloads === 1, "Free tier has 1 download/day limit")
  runner.assert(freeConfig.maxQuality === "480p", "Free tier max streaming quality is 480p")
  runner.assert(freeConfig.concurrentStreams === 1, "Free tier allows 1 concurrent stream")

  const silverConfig = PLAN_CONFIGURATIONS.silver
  runner.assert(silverConfig.dailyDownloads === 15, "Silver tier has 15 downloads/day limit")
  runner.assert(silverConfig.maxQuality === "1080p", "Silver tier max streaming quality is 1080p")
  runner.assert(silverConfig.concurrentStreams === 2, "Silver tier allows 2 concurrent streams")

  const goldConfig = PLAN_CONFIGURATIONS.gold
  runner.assert(goldConfig.dailyDownloads === 50, "Gold tier has 50 downloads/day limit")
  runner.assert(goldConfig.maxQuality === "4k", "Gold tier max streaming quality is 4k")
  runner.assert(goldConfig.concurrentStreams === 5, "Gold tier allows 5 concurrent streams")

  // 3. canAccessPlanContent Checks
  runner.assert(canAccessPlanContent("free", "free") === true, "Free user can access Free content")
  runner.assert(canAccessPlanContent("free", "bronze") === false, "Free user CANNOT access Bronze content")
  runner.assert(canAccessPlanContent("free", "silver") === false, "Free user CANNOT access Silver content")
  runner.assert(canAccessPlanContent("free", "gold") === false, "Free user CANNOT access Gold content")

  runner.assert(canAccessPlanContent("bronze", "bronze") === true, "Bronze user can access Bronze content")
  runner.assert(canAccessPlanContent("bronze", "silver") === false, "Bronze user CANNOT access Silver content")

  runner.assert(canAccessPlanContent("silver", "bronze") === true, "Silver user can access Bronze content (inherited)")
  runner.assert(canAccessPlanContent("silver", "silver") === true, "Silver user can access Silver content")
  runner.assert(canAccessPlanContent("silver", "gold") === false, "Silver user CANNOT access Gold content")

  runner.assert(canAccessPlanContent("gold", "silver") === true, "Gold user can access Silver content (inherited)")
  runner.assert(canAccessPlanContent("gold", "gold") === true, "Gold user can access Gold content")

  // 4. isQualityAllowed Checks
  runner.assert(isQualityAllowed("free", "480p").allowed === true, "Free user can stream in 480p")
  runner.assert(isQualityAllowed("free", "1080p").allowed === false, "Free user CANNOT stream in 1080p")
  runner.assert(isQualityAllowed("silver", "1080p").allowed === true, "Silver user can stream in 1080p")
  runner.assert(isQualityAllowed("silver", "4k").allowed === false, "Silver user CANNOT stream in 4k")
  runner.assert(isQualityAllowed("gold", "4k").allowed === true, "Gold user can stream in 4k")

  // 5. Authoritative Pricing Math
  const monthly = calculatePlanPricing(499, "monthly")
  runner.assert(monthly.price === 499, "Monthly pricing calculation returns base price")

  const quarterly = calculatePlanPricing(499, "quarterly")
  // 499 * 3 = 1497 * 0.9 = 1347.3 -> 1347
  runner.assert(quarterly.price === 1347, "Quarterly pricing applies 10% discount")

  const yearly = calculatePlanPricing(499, "yearly")
  // 499 * 12 = 5988 * 0.8 = 4790.4 -> 4790
  runner.assert(yearly.price === 4790, "Yearly pricing applies 20% discount")

  return runner.summary()
}

if (process.argv[1]?.endsWith("planFeatures.test.js")) {
  runPlanFeaturesUnitTest()
    .then((res) => {
      process.exit(res.failed > 0 ? 1 : 0)
    })
    .catch(() => {
      process.exit(1)
    })
}

export default runPlanFeaturesUnitTest
