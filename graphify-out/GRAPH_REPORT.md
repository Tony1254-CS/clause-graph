# Graph Report - clause-graph  (2026-10-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1471 nodes · 3651 edges · 89 communities (57 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7396fce5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85

## God Nodes (most connected - your core abstractions)
1. `cn()` - 220 edges
2. `react` - 93 edges
3. `lucide-react` - 65 edges
4. `AppShell()` - 55 edges
5. `@tanstack/react-router` - 45 edges
6. `@tanstack/react-start` - 39 edges
7. `FileRoutesByPath` - 32 edges
8. `@tanstack/react-query` - 27 edges
9. `query()` - 26 edges
10. `requireAuth` - 22 edges

## Surprising Connections (you probably didn't know these)
- `on_auth_user_created` --triggers--> `auth.users`  [EXTRACTED]
  supabase/migrations/20260725100225_496e8b64-4699-4f3f-93bf-cc791c1cee04.sql → docker/init.sql
- `public.subscriptions` --references--> `auth.users`  [EXTRACTED]
  supabase/migrations/20260725103103_e8014f17-4d72-4b72-9705-769ed13fa523.sql → docker/init.sql
- `public.background_jobs` --references--> `auth.users`  [EXTRACTED]
  supabase/migrations/20260726130000_background_jobs_queue.sql → docker/init.sql
- `PredictiveNotFound()` --calls--> `AppShell()`  [EXTRACTED]
  src/routes/_authenticated/predictive.tsx → src/components/clausegraph/AppShell.tsx
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/alert-dialog.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (89 total, 32 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (70): auth.uid(), auth.users, clauses_contract_id_idx, contracts_org_created_idx, contracts_org_id_idx, idx_org_deletion_scheduled_at, on_auth_user_created, profiles_org_id_idx (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (53): ClauseRow(), RegulationPill(), backtestCasesQuery, ClauseRow, ComplianceArtifactRow, complianceArtifactsQuery, complianceProfileQuery, contractQuery() (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (30): contracts_org_created_idx, idx_subscriptions_org_id, idx_subscriptions_paddle_id, idx_subscriptions_user_id, public.assert_within_quota(), public.get_org_usage(), public.paddle_events, public.subscriptions (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (36): AUTHORITATIVE_LEGAL_CORPUS, CITATION_PATTERNS, extractCitations(), normalizeActName(), normalizeSection(), getAuthoritativeCorpus, verifyCitationText, DatabaseRegulationRow (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (44): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Card, CardContent (+36 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (40): Input, Separator, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (37): clearSession(), getCurrentUser(), getToken(), saveSession(), signInDemo(), signInWithPassword(), signUpWithPassword(), demoLoginFn (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (33): sonner, LiveShockSimulatorModal(), LiveShockSimulatorModalProps, PRESET_SHOCK_SCENARIOS, ShockScenario, COUNTRIES, FRAMEWORK_DESCRIPTIONS, INDUSTRIES (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (42): ApiPublicHealthRoute, ApiPublicPaymentsWebhookRoute, ApiPublicVerifyCitationsRoute, AuthenticatedActionsRoute, AuthenticatedBacktestRoute, AuthenticatedContractsContractIdRoute, AuthenticatedContractsIndexRoute, AuthenticatedContractsRoute (+34 more)

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (25): lucide-react, react-dom, @tanstack/react-query, @tanstack/react-router, AppShell(), CopilotProvider(), JurisdictionChip(), NotificationChannelsModal() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (36): dependencies, bcryptjs@^2.4.3, class-variance-authority@^0.7.1, clsx@^2.1.1, input-otp@^1.4.2, lucide-react@^0.575.0, pg@^8.13.3, @radix-ui/react-accordion@^1.2.12 (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (26): BACKUP_DIR, computeDocumentHash(), computeVersionDiff(), createSystemBackup(), ensureBackupDir(), executeLegalSourceCheck(), getLegalSourceById(), ingestCandidateUpdate() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (33): devDependencies, eslint@^9.32.0, eslint-config-prettier@^10.1.1, @eslint/js@^9.32.0, eslint-plugin-prettier@^5.2.6, eslint-plugin-react-hooks@^5.2.0, eslint-plugin-react-refresh@^0.4.20, globals@^15.15.0 (+25 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (27): assignReviewTaskFn, createManualReviewTaskFn, getReviewStatsFn, getReviewTaskFn, listReviewTasksFn, submitReviewDecisionFn, ALLOWED_TRANSITIONS, assignReviewTask() (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (26): query(), getJobFn, acquireNextJobs(), cancelJob(), completeJob(), enqueueJob(), failJob(), getJobById() (+18 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (29): context, dockerfile, postgres, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, interval, retries (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (21): UploadContract(), SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (20): @tanstack/react-start, BacktestCard(), formatFine(), SEV_DOT, SEV_LABEL, BacktestCaseRow, BacktestRow, simulateBacktest (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (26): @hookform/resolvers@^5.2.2, @radix-ui/react-popover@^1.1.15, @radix-ui/react-progress@^1.1.8, @radix-ui/react-separator@^1.1.8, @radix-ui/react-slider@^1.3.6, @radix-ui/react-tabs@^1.1.13, @radix-ui/react-toggle-group@^1.1.11, react-day-picker@^9.14.0 (+18 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (15): react, Checkbox, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, PopoverContent (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (20): PlanLimitDialog(), PlanLimitReason, PlanMini(), REASON_COPY, profileQuery, getOrgUsage, OrgUsage, BILLING_ENABLED (+12 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (18): ChatCompletionOptions, ChatMessage, Amendment, ForecastEntry, generateHypotheticalAmendment, HypotheticalAmendment, predictAmendmentRisk, ProbabilityBand (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (21): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (17): DEFAULT_SETTINGS, VoiceContext, VoiceContextValue, VoiceProvider(), chunkTextIntoSentences(), getAvailableNaturalVoices(), isNaturalVoice(), rankVoices() (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (18): Props, SEV_COLOR, SupplyChainGraph(), CascadeHit, CascadeResult, ChainEdge, ChainNode, getSupplyChain (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (16): ActionPlanPanel(), onCopy(), planToMarkdown(), GraphMedallion(), Node, Props, SEV_COLOR, useReducedMotion() (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (14): attachAuth, consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), fetch() (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.19
Nodes (15): CopilotContext, CopilotContextType, chatWithCopilotFn, CopilotQueryInput, CopilotChatMessage, CopilotInspectContext, CopilotResponse, executeCopilotQuery() (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (12): TopBar(), handleExportDossier(), handleSignOut(), useTheme(), ThemeToggle(), signOut(), DossierData, generateExecutiveComplianceDossier() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.16
Nodes (15): Props, chatCompletion(), getPool(), queryOne(), transaction(), approveDocumentVersion(), runIsolatedRestoreTest(), deleteContract (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 31 - "Community 31"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (11): PRIORITY_DOT, Props, fallbackActionPlan, generateActionPlan, coerceActionPlan(), PRIORITIES, ActionPlan, ActionPlanInput (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.17
Nodes (10): CodeBlock(), ComplianceCodePanel(), EXT, Props, useTyping(), CodeArtifact, ComplianceCode, generateComplianceCode (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.23
Nodes (13): NotificationBell(), ToastCard(), ToastContainer(), DEFAULT_WEBHOOK_CONFIG, INITIAL_NOTIFICATIONS, NotificationContext, NotificationContextValue, useNotifications() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.21
Nodes (14): PaymentTestModeBanner(), OpenOptions, usePaddleCheckout(), resolvePaddlePrice, clientToken, getPaddleEnvironment(), getPaddlePriceId(), initializePaddle() (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (8): AudioWaveform(), useCopilot(), ExecutiveBriefingCard(), ExecutiveBriefingProps, GlobalCopilot(), InspectLensOverlay(), useVoice(), Dashboard()

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (8): readInitialTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider(), RootComponent(), Route, FileRoutesById

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (12): ContractCard(), StatusBadge(), contractsQuery, formatUSD(), ActionsPage(), ArtifactConsoleCard(), CopyButton(), FILTERS (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (10): class-variance-authority, Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext, ToggleGroupItem (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (12): RouteError(), Route, Route, Route, Route, Route, Route, Route (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.41
Nodes (10): approveCandidateVersionFn, getBackupsListFn, getCandidateVersionsFn, getLegalSourcesFn, rejectCandidateVersionFn, runRestoreTestFn, triggerBackupRunFn, triggerSourceCheckFn (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.18
Nodes (11): scripts, build, build:dev, dev, eval, eval:live, format, lint (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (9): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): @radix-ui/react-slot, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 49 - "Community 49"
Cohesion: 0.29
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 51 - "Community 51"
Cohesion: 0.29
Nodes (6): @tailwindcss/vite@^4.2.1, vite@^8.0.16, @vitejs/plugin-react@^5.2.0, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 52 - "Community 52"
Cohesion: 0.57
Nodes (6): Banner(), BillingStatusBanner(), DeletionBanner(), fmtDate(), OrgStatus, PlanStatusBanner()

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (3): DetailInspector(), ReviewQueuePage(), handleAssign()

### Community 54 - "Community 54"
Cohesion: 0.60
Nodes (4): CitationFindingCard(), CitationVerificationBadge(), StaleCitationVerificationPanel(), STATUS_CONFIG

### Community 55 - "Community 55"
Cohesion: 0.40
Nodes (4): getRouter(), Register, routeTree, startInstance

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (3): jspdf@^4.2.1, jspdf, exportPdf()

## Knowledge Gaps
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 19` to `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 13`, `Community 16`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 29`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 44`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 54`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.053554040895813046 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Community 9` to `Community 1`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 10`, `Community 13`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 25`, `Community 27`, `Community 28`, `Community 32`, `Community 33`, `Community 34`, `Community 36`, `Community 37`, `Community 40`, `Community 41`, `Community 44`, `Community 47`, `Community 48`, `Community 50`, `Community 52`, `Community 54`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06013986013986014 - nodes in this community are weakly interconnected._
- **Why does `cn()` connect `Community 4` to `Community 36`, `Community 5`, `Community 38`, `Community 7`, `Community 41`, `Community 42`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 19`, `Community 16`, `Community 22`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06203007518796992 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.1037037037037037 - nodes in this community are weakly interconnected._