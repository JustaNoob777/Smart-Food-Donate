/** String references for the small C REST adapter used by the existing pages. */
export const api = {
  users: { currentUser: "users.currentUser" },
  activity: { recent: "activity.recent" },
  donations: {
    list: "donations.list",
    available: "donations.available",
    mine: "donations.mine",
    stats: "donations.stats",
    weeklyDistribution: "donations.weeklyDistribution",
    create: "donations.create",
  },
  requests: {
    list: "requests.list",
    mine: "requests.mine",
    pendingQueue: "requests.pendingQueue",
    create: "requests.create",
    approve: "requests.approve",
    advanceStep: "requests.advanceStep",
  },
  profile: { update: "profile.update" },
} as const;
