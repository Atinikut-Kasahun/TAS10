<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class JobRequisition extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'requested_by',
        'title',
        'description',
        'department',
        'location',
        'headcount',
        'budget',
        'position_type',
        'priority',
        'status', // pending, approved, rejected
        'rejection_reason',
        'approved_at',
        'approved_by',
        'jd_path',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * The job posting created when TA team publishes this requisition.
     */
    public function jobPosting(): HasOne
    {
        return $this->hasOne(JobPosting::class, 'job_requisition_id');
    }
}
