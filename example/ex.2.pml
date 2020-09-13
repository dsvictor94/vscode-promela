int i;

active proctype client() {
    for (i : 1 .. 10) {
        printf("xi = %d\n", i)
    }
}