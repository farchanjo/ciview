// DDD role: ValueObject
// Feature 003 — adaptive layout budget + smart log modal chrome shapes.
// Nested groups keep #LayoutBudget under the small-entities field cap.

package schemas

// DDD role: ValueObject
#PositiveInt: int & >0

// DDD role: ValueObject
#NonNegInt: int & >=0

// DDD role: ValueObject
#Flag: bool

// DDD role: ValueObject
#Density: "compact" | "normal" | "comfortable"

// DDD role: ValueObject
#LogViewMode: "smart" | "errors" | "all"

// DDD role: ValueObject
#ModalBox: {
	left:        #NonNegInt
	top:         #NonNegInt
	width:       #PositiveInt
	height:      #PositiveInt
	contentRows: #PositiveInt
	maxLineCols: #PositiveInt
	chromeRows:  #NonNegInt
}

// DDD role: ValueObject
#LayoutBudget: {
	term: {
		width:                   #PositiveInt
		height:                  #PositiveInt
		density:                 #Density
		statusRows:              #PositiveInt
		sidebarVisibleEffective: #Flag
		sidebarWidth:            #NonNegInt
	}
	board: {
		stripRows:     #NonNegInt
		stageColWidth: #PositiveInt
	}
	logModal:  #ModalBox
	helpModal: #ModalBox
}

// DDD role: ValueObject
#LogChrome: {
	logOpen:             #Flag
	logMode:             #LogViewMode
	logFollow:           #Flag
	logScrollFromBottom: #NonNegInt
	logErrorCursor:      #NonNegInt
}

// Feature root
// DDD role: ValueObject
#AdaptiveTerminalLayoutSmartJobLogModal1ComputeAll: {
	budget: #LayoutBudget
	log:    #LogChrome
}
