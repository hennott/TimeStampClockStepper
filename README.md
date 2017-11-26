# TimeStampClockStepper
This is a simple script on nodeJS to run with an TinkerForge RED to generate a stepper signal for a old time stamp clock with alternating impulse. So you get an fully automated modern stepper with NTP-synchronisation.

# Features
- synchronisation to a ntp service (if the tinkerforge RED has access to the internet)
- detects leap years and runs faster to the next month
- detects end of month and runs faster to the next month
- stores last state locally in case of power interrupts
- "intelligent" adjustment of time differences
- can adjust the time arbitrarily via a control file
- controls a quadruple relay for the simple pulse sequence (+ + + +) or alternately inverse impulse sequence (+ - + -)
- can set to be sync with the clock by a simple cloud connection
- can be monitored with a simple cloud connection
- displays the state of the stack on a smart OLED display

# Background
This is a simple project to bring an very old school time stamp clock together with a very modern rapid prototype environment based on nodeJS. It was just fun but now working in real and maybe interessting for nobody.
