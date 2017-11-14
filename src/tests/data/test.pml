// a small example spin model
// Peterson's solution to the mutual exclusion problem (1981)

bool turn, flag[2];		// the shared variables, booleans
byte ncrit;        		// nr of procs in critical section

active [2] proctype user()	// two processes
{
	byte cc;
	assert(_pid == 0 || _pid == 1);
again:
	flag[_pid] = 1;
	turn = _pid;
	(flag[1 - _pid] == 0 || turn == 1 - _pid);

	ncrit++;
	cc++;
	assert(ncrit == 1);	// critical section
	ncrit--;

	flag[_pid] = 0;
	goto again
}
// analysis:
// $ spin -run peterson.pml