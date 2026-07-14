// DDD role: ValueObject
// Feature 004 — multi-host glab picker chrome + prefs shapes.
// Tokens never appear in these value objects.

package schemas

// DDD role: ValueObject
#Hostname: string & =~"^[A-Za-z0-9._-]+$" & !=""

// DDD role: ValueObject
#Username: string & !=""

// DDD role: ValueObject
#Flag: bool

// DDD role: ValueObject
#NonNegInt: int & >=0

// DDD role: ValueObject
#GlabHostOption: {
	hostname: #Hostname
	apiHost:  #Hostname
	user?:    #Username
	hasToken: true
}

// DDD role: ValueObject
#HostPickerChrome: {
	hostPickerOpen:     #Flag
	hostPickerCursor:   #NonNegInt
	hostPickerRequired: #Flag
}

// DDD role: ValueObject
#GitlabHostPref: {
	// null when never chosen
	gitlabHost: #Hostname | null
}

// DDD role: ValueObject
#AuthenticatedHostList: {
	items: [...#GlabHostOption]
}

// Feature root — nested groups avoid bare collection + scalar mix
// DDD role: ValueObject
#MultiHostGitlabPicker: {
	prefs:  #GitlabHostPref
	chrome: #HostPickerChrome
	hosts:  #AuthenticatedHostList
}
