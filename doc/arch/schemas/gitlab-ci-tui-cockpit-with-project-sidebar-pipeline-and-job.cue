// DDD role: ValueObject

package schemas

// Compact CUE view of the ciview cockpit feature root.
// Richer narrative model: doc/arch/sdd/001-*/data-model.md

// DDD role: ValueObject
#HostUrl: string & =~"^https?://"

// DDD role: ValueObject
#TokenSource: "env" | "glab" | "flag"

// DDD role: ValueObject
#PollIntervalMs: int & >=1000 & <=60000

// DDD role: ValueObject
#Flag: bool

// DDD role: ValueObject
#AuthConfig: {
	host:        #HostUrl
	tokenSource: #TokenSource
}

// DDD role: ValueObject
#LivePollConfig: {
	intervalMs: #PollIntervalMs
	live:       #Flag
	logFollow:  #Flag
}

// Feature root — session configuration surface for the TUI cockpit.
// DDD role: ValueObject
#GitlabCiTuiCockpitWithProjectSidebarPipelineAndJob: {
	auth: #AuthConfig
	poll: #LivePollConfig
}
