<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // 'active' | 'resigned' | 'terminated'
            $table->string('employment_status')->default('active')->after('tenant_id');
            // The date the employee left (null if still active)
            $table->date('separation_date')->nullable()->after('employment_status');
            // Free-text or enum reason
            $table->string('separation_reason')->nullable()->after('separation_date');
            // When this user joined / was onboarded (defaults to created_at if null)
            $table->date('joined_date')->nullable()->after('separation_reason');
            // Department name
            $table->string('department')->nullable()->after('joined_date');

            // Index for turnover report queries
            $table->index(['tenant_id', 'employment_status', 'separation_date'], 'users_turnover_idx');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_turnover_idx');
            $table->dropColumn(['employment_status', 'separation_date', 'separation_reason', 'joined_date']);
        });
    }
};
