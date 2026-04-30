---
date: "2026-04-25"
ticker: MSFT
sector: Tech
verdict: BUY
confidence: 0.90
relevance: 0.90
decayScore: 0.6595
verified: false
country: US
source: reddit
url: "https://www.reddit.com/r/stocks/comments/1svhdyi/intel_is_killing_themselves_and_the_market_is/"
tags:
  - news
  - msft
  - buy
  - world-brain
  - tech
---

# Intel is killing themselves and the market is celebrating

**Verdict**: BUY (90% confidence)  
**Relevance to [[MSFT]]**: 90%  
**Geographic origin**: US  

## Summary
Intel is killing themselves and the market is celebrating

INTC ripped 23% on Friday to an all-time closing high. Q1 was genuinely, unquestionably good - revenue $13.6B (+7% YoY), DCAI $5.1B (+22% YoY), non-GAAP EPS of $0.29 vs. $0.01 expected thanks to hyperscaler capex pumping demand of everything up (GPUs, then power, then memory, then cooling, then storage, then photonics, and now CPUs).

That’s great. Now Intel can take the extra cash, use it to retool their foundry, and life is hopefully better by the time CPU demand cools because they actually have AI products to sell. Turnaround locked into place, paid by NVIDIA. Nice.

Lip-Bu Tan however then got on call and said "the CPU is reinserting itself as the indispensable foundation of the AI era." The stock exploded. Everyone finished. It’s not just Reddit thanking Nana, even the banks have dubbed it a "CPU renaissance." Wedbush's Dan Ives raised his PT to $95 and put it in the same bucket as MSFT and ORCL as a multi-year AI play. MarketWatch literally wrote "How Intel's CEO brought back the storied company from the brink."

Amazing.

Except for one small problem - CPUs aren’t relevant in the context of AI. One prompt to a cold LLM (or a SWE with a calculator) would debunk the claim instantaneously, and the people building the narrative either don’t know or don’t care. No, seriously - put any of Tan’s quotes into an LLM, don’t tell it it’s from the Intel CEO, and watch it go "what are we smoking here" in its thinking blocks.

# The technical claim is nonsense

The pitch is: AI is moving from training to inference to agentic, and agentic workloads need way more CPU because of "orchestration, memory management, and data movement." Lipacis at Evercore says the CPU-to-GPU ratio could flip from 1:8 to 8:1. Datacenters are therefore going to spend more on CPUs.

Lmao.

Firstly: CPUs do not do inference on any meaningful scale. Anyone who is posting "agentic workloads will be on inference, not training!!!!11!!" - correct. That is literally the point. Ask your LLM why Micron and SanDisk are pumping on a technical basis. They’ll give you some boring explanation about model weights, KV cache, context windows, blah blah blah. Not important. The key is to note how CPUs slot into none of the explanations, then overlay the SNDK and INTC chart on each other. The fact that Llama or Qwen or whatever other quantized model exists and can run on your CPU is a bet entirely on local LLMs that by definition do NOT need a datacenter to run - **they run precisely because they do LESS inference.**

Secondly: Claude here wrote about boring technical stuff that just dunked on the accuracy of the "8:1 claim", and it's too informationally dense to paraphrase. So I’ll give an analogical TL;DR instead:

Imagine a restaurant (agentic workflow) where the kitchen (LLM) does the cooking and the host stand (software harness) seats people and brings out food. It’s great. Demand triples. The business gets more and more viable at scale, so you start building more restaurants, which requires investment.

Now you have to decide what allocation of your capital to invest in whenever you build a new restaurant. Yes, the host stand is usually busy in a good restaurant, and you have to employ more hosts. No, you do not conclude the host stand is "the indispensable foundation of dining" and invest everything into hosts. This is like selling a restaurant where the waiting staff is the main attraction, and… oh right, that business model already went bankrupt before.

Obviously, you have to employ more hosts (CPUs) during the one-time expansion: but at maturity? What are the recurring costs for your restaurant? Ingredients (power), equipment (cooling, ASICs, whatever), and the chefs (GPUs, which need high bandwidth memory and advanced packaging). **Host employment spikes during expansion, but they never become a recurring churn.**

The Morgan Stanley "$32.5-60B incremental CPU TAM" and "50-90% of system latency is CPU-side" numbers? They're measuring wall-clock time (that is literally based on the latency of Google search or API calls or Salesforce being shit) and labeling it "CPU bottleneck". The actual content is network latency, framework overhead, and tool execution. AKA - what software has been since… forever. None of it is CPU compute. A faster CPU doesn't make a Google search API return faster. There is nothing remotely new about "agentic" workflows, this is literally just what happens when people (or in this case, LLMs) use more software. Claude calculated something like a 1:5 million ratio of compute overhead when comparing CPUs to GPUs.

Or to put it simply: When Claude Code goes from 200K to 1M tokens, CPU requirements increase by a grand total of maybe 10% (it’s shuffling the same tool calls around and tokenizes the input/output) while the GPU requirements start growing in ridiculous scale. Ergo, AI getting better does NOT mean more CPU demand. More software usage means more CPU demand (which has been true since forever), and the ratio of GPU to CPU work only gets more lopsided as models scale. **More people using AI generates more software demand, but this is third-order at best (AI -&gt; users -&gt; traffic -&gt; CPUs), not structural (AI -&gt; GPU). A buzzword does not change this.**

What's actually driving Intel's 22% DCAI growth: hyperscalers are spending a metric ton ($700B) combined on AI infrastructure that includes typical datacenters for increased software flow, not only the compute kind, and CPU margins are expanding from this demand. **But as CapEx stabilises from this point or supply modulates, AI-native components will continue experiencing demand due to upgrades and refresh cycles, whereas CPUs will only be bought at fractions of the initial buildout amount.** In other words, while other components might experience compressed margins, CPUs will genuinely hit oversupply.

For anyone running a business that’s currently only doing CPU, this should be a warning sign to switch to components that will maintain pricing power (memory, optics, custom silicon, packaging - literally anything else).

# The problem isn’t that it’s a "cycle", it’s that Intel is taking this tailwind and treating it as being God’s chosen son

Here's where it goes from "narrative inflation" to "actively destroying the company." Lisa Su's playbook is right there. Take Ryzen competitiveness as a windfall, then *diversify out of CPU dependence* \- there is a reason why AMD is now hardcore GPUmaxxing with a product revenue line that isn’t "94% CPU".

Intel’s allocation in Q1 2026 is the inverse. Diamond Rapids and Coral Rapids dominate the roadmap (both CPU plays). ASIC business (what Broadcom and Marvell do) explicitly described as **"short term" and "tactical."** Gaudi shelved. Falcon Shores dead (these are both AI accelerators that my LLM very helpfully autocompleted). The actual forward-looking bets being treated as writeoffs. And this: Intel is buying back 49% of the Leixlip **CPU** fab from Apollo for **$14.2B** \- $3B above what they sold it for in 2024 - to consolidate ownership of manufacturing capacity whose primary customer is Intel's own x86 roadmap. **They are intending to flood supply of something that is experiencing a temporary demand boost, invoking a buzzword as the reason "this will persist".** Now, if they had instead loudly talked about "CPU dominance" while quietly shuffling the chips to retool in the back, this wouldn’t be as alarming, but nothing about the release reads as strategic vagueness. Think BlackBerry saying that "the touchscreen is bad for typing" or Steve Ballmer calling the iPhone crap. It’s not a smokescreen, it’s genuine belief.

Zuck’s Metaverse.

# The bill comes due at some point

2026 is good. 2027 probably still good - Rubin ramps, agentic narrative buys time. Then capex normalizes, AMD keeps taking share, ARM hosts (Graviton, Cobalt, Axion, Vera) eat x86 sockets at the top tier - Vera is NVIDIA's own ARM CPU shipping in Rubin, by the way; the "more CPUs per GPU" trend the sell-side cites as bullish for Intel is literally NVIDIA capturing the host socket itself - DCAI compresses to pre-buildout numbers, and the CPU margin trajectory abruptly stalls. **And then, once CapEx shifts more towards upgrades rather than the first-wave buildout, CPUs will be left in the dust.**

By then the existential doubling down on CPUs can't be reversed. Intel’s non-CPU segments need to have inflected by that point so that the stock doesn’t tank, but with every passing quarter directing capital at CPUs rather than retooling to become an AI benefactor, that possibility moves closer to zero.

The sovereign put (CHIPS Act, national security) is real, but it cannot protect from genuine stupidity (my LLM advised me to not call Intel stupid, but I don’t care, I’m putting my foot down)**.** The entire reason the administration (and every American, honestly) bought into Intel was with the impression that they would fix their foundry business and become a genuine alternative to TSMC for AI-native chips. Instead, Intel is taking the windfall and using it to allocate more towards CPUs while invoking a buzzword. It’s like subsidizing someone’s rent so they can take shifts off to apply for a full-time job and they begin "working on themselves" instead. We bought Intel so we don’t have to worry about Taiwan, and what we got was more CPUs.

I am long Micron. I am long SanDisk. I am long NVIDIA. I am long Broadcom. I am long Lumentum. I am long anything AI-related. I am NOT long on CPUs, I’m calling the bubble right now.

**TL;DR: The long thesis on this rip is built on a technical claim that doesn't survive a calculator, and the CEO is allocating capital like he believes his own marketing.**

NFA. Do your own DD. But run the FLOPs math yourself with your clanker of choice before you buy the "renaissance".

## AI Analysis
_No analysis available._

## Links
- [Source Article](https://www.reddit.com/r/stocks/comments/1svhdyi/intel_is_killing_themselves_and_the_market_is/)
- [[MSFT]]
- [[US-news]]
